import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';
import { signToken } from '../src/middleware/auth.js';

describe('Product waitlist', () => {
  const stamp = Date.now();
  let userCookie, adminCookie;

  before(async () => {
    await runMigrations();
    const user = await request(app).post('/api/v1/auth/register').send({
      name: 'Waitlist Viewer', email: `wl_user_${stamp}@test.com`, password: 'Password123!'
    });
    userCookie = user.headers['set-cookie'].find((c) => c.startsWith('ideapulse_token=')).split(';')[0];

    const adminRes = await db.prepare(`
      INSERT INTO users (name, email, password_hash, role) VALUES ('WL Admin', ?, '!oauth', 'admin')
    `).run(`wl_admin_${stamp}@test.com`);
    adminCookie = `ideapulse_token=${signToken({ id: adminRes.lastInsertRowid, role: 'admin', token_version: 0 })}`;
  });

  test('Anyone can join; the total count goes up', async () => {
    const before = (await request(app).get('/api/v1/waitlist/count')).body.data.total;
    const res = await request(app).post('/api/v1/waitlist').send({
      email: `  Fan_${stamp}@Example.com `, name: 'Fan One', use_case: 'Validate my SaaS idea', source: 'landing'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.total, before + 1);
  });

  test('Joining twice does not duplicate and gives the same response', async () => {
    const before = (await request(app).get('/api/v1/waitlist/count')).body.data.total;
    const res = await request(app).post('/api/v1/waitlist').send({ email: `fan_${stamp}@example.com` });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.total, before);
  });

  test('Rejects invalid emails, oversized fields and filled honeypots', async () => {
    assert.strictEqual((await request(app).post('/api/v1/waitlist').send({ email: 'not-an-email' })).status, 400);
    assert.strictEqual((await request(app).post('/api/v1/waitlist').send({ email: `x_${stamp}@example.com`, use_case: 'a'.repeat(301) })).status, 400);
    assert.strictEqual((await request(app).post('/api/v1/waitlist').send({ email: `bot_${stamp}@example.com`, website: 'http://spam' })).status, 400);
  });

  test('Only admins can list or export signups', async () => {
    assert.strictEqual((await request(app).get('/api/v1/waitlist')).status, 401);
    assert.strictEqual((await request(app).get('/api/v1/waitlist').set('Cookie', userCookie)).status, 403);
    assert.strictEqual((await request(app).get('/api/v1/waitlist/export.csv').set('Cookie', userCookie)).status, 403);

    const res = await request(app).get('/api/v1/waitlist').set('Cookie', adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.stats.total >= 1);
    assert.ok(res.body.data.stats.today >= 1);
    assert.ok(res.body.data.signups.some((s) => s.email === `fan_${stamp}@example.com`));
    assert.ok(Array.isArray(res.body.data.daily));
  });

  test('CSV export neutralises spreadsheet formulas', async () => {
    await request(app).post('/api/v1/waitlist').send({ email: `formula_${stamp}@example.com`, name: '=HYPERLINK("http://evil")' });
    const res = await request(app).get('/api/v1/waitlist/export.csv').set('Cookie', adminCookie);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.ok(res.text.includes(`"'=HYPERLINK(""http://evil"")"`));
    assert.ok(!res.text.includes(`,"=HYPERLINK`));
  });
});
