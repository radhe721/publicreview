import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';
import { testOutbox } from '../src/services/mailer.js';

const tokenFromMail = (mail) => mail.text.match(/reset-password#token=([a-f0-9]{64})/)[1];

describe('Password reset', () => {
  const timestamp = Date.now();
  const user = {
    name: 'Reset Test User',
    email: `reset_${timestamp}@example.com`,
    password: 'OriginalPassword1!'
  };
  let oldSessionCookie;

  before(async () => {
    await runMigrations();
    const res = await request(app).post('/api/v1/auth/register').send(user);
    assert.strictEqual(res.status, 201);
    oldSessionCookie = res.headers['set-cookie'];
  });

  test('unknown email gets the same generic response and no email is sent', async () => {
    const before = testOutbox.length;
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `nobody_${timestamp}@example.com` });

    assert.strictEqual(res.status, 200);
    assert.match(res.body.message, /if an account exists/i);
    assert.strictEqual(testOutbox.length, before);
  });

  test('reset link resets password, revokes old sessions, and is single-use', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email.toUpperCase() });
    assert.strictEqual(res.status, 200);

    const mail = testOutbox.at(-1);
    assert.strictEqual(mail.to, user.email);
    const token = tokenFromMail(mail);

    const stored = await db.prepare('SELECT token_hash FROM password_reset_tokens WHERE token_hash = ?').get(token);
    assert.strictEqual(stored, null, 'raw token must not be stored');

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'BrandNewPassword2!' });
    assert.strictEqual(reset.status, 200);
    assert.strictEqual(reset.body.data.user.email, user.email);
    assert.strictEqual(reset.body.data.user.password_hash, undefined);
    assert.ok(reset.headers['set-cookie'].some((c) => c.includes('ideapulse_token=')));

    const oldSession = await request(app).post('/api/v1/auth/logout-all').set('Cookie', oldSessionCookie);
    assert.strictEqual(oldSession.status, 401, 'sessions from before the reset must be revoked');

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    assert.strictEqual(oldLogin.status, 401);
    const newLogin = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'BrandNewPassword2!' });
    assert.strictEqual(newLogin.status, 200);

    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'AnotherPassword3!' });
    assert.strictEqual(reuse.status, 400);
  });

  test('requesting a new link invalidates the previous one', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const first = tokenFromMail(testOutbox.at(-1));
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const second = tokenFromMail(testOutbox.at(-1));

    const stale = await request(app).post('/api/v1/auth/reset-password').send({ token: first, password: 'StalePassword4!' });
    assert.strictEqual(stale.status, 400);
    const fresh = await request(app).post('/api/v1/auth/reset-password').send({ token: second, password: 'FreshPassword5!' });
    assert.strictEqual(fresh.status, 200);
  });

  test('expired and malformed tokens are rejected', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    const token = tokenFromMail(testOutbox.at(-1));
    await db.prepare(`UPDATE password_reset_tokens SET expires_at = datetime('now', '-1 minute')`).run();

    const expired = await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'ExpiredPassword6!' });
    assert.strictEqual(expired.status, 400);

    const malformed = await request(app).post('/api/v1/auth/reset-password').send({ token: 'abc', password: 'Whatever1234!' });
    assert.strictEqual(malformed.status, 400);

    const weak = await request(app).post('/api/v1/auth/reset-password').send({ token: 'a'.repeat(64), password: 'short' });
    assert.strictEqual(weak.status, 400);
  });
});
