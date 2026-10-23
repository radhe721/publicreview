import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';

describe('Auth Endpoints & Security Supertest Suite', () => {
  const timestamp = Date.now();
  const validUser = {
    name: 'Auth Test User',
    email: `authtest_${timestamp}@example.com`,
    password: 'SecurePassword123!',
    bio: 'QA Engineer and Builder'
  };

  before(async () => {
    await runMigrations();
  });

  test('Sign up valid returns 201, sets httpOnly cookie, and hides password hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validUser);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.user);
    assert.strictEqual(res.body.data.user.email, validUser.email.toLowerCase());
    assert.strictEqual(res.body.data.user.password_hash, undefined);
    assert.strictEqual(res.body.data.user.password, undefined);

    // Verify cookie attributes
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies && cookies.length > 0, 'Must set auth cookie');
    const authCookie = cookies.find(c => c.includes('ideapulse_token='));
    assert.ok(authCookie, 'ideapulse_token cookie must be present');
    assert.ok(authCookie.includes('HttpOnly') || authCookie.includes('httponly'), 'Must be HttpOnly');
    assert.ok(authCookie.includes('SameSite') || authCookie.includes('samesite'), 'Must specify SameSite');
  });

  test('Sign up duplicate email returns 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validUser);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error.message, /already exists/i);
  });

  test('Sign up rejects invalid email, weak password, and missing fields with 400', async () => {
    // Missing name
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'valid@example.com', password: 'ValidPassword1' });
    assert.strictEqual(res1.status, 400);

    // Invalid email format
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'User', email: 'not-an-email', password: 'ValidPassword1' });
    assert.strictEqual(res2.status, 400);

    // Weak password (< 6 chars)
    const res3 = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'User', email: 'weak@example.com', password: '123' });
    assert.strictEqual(res3.status, 400);
  });

  test('Login rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'WrongPassword999!' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error.message, /Invalid email or password/i);
  });

  test('Login non-existent user returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `nonexistent_${Date.now()}@test.com`, password: 'SomePassword123' });

    assert.strictEqual(res.status, 401);
  });

  test('Correct login returns 200, sets httpOnly SameSite cookie, and never leaks password_hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.user);
    assert.strictEqual(res.body.data.user.password_hash, undefined);
    assert.strictEqual(res.body.data.user.password, undefined);

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies);
    const authCookie = cookies.find(c => c.includes('ideapulse_token='));
    assert.ok(authCookie.includes('HttpOnly') || authCookie.includes('httponly'));
    assert.ok(authCookie.includes('SameSite') || authCookie.includes('samesite'));
  });

  test('Protected route /api/v1/auth/me behaves correctly with and without cookie', async () => {
    // Unauthenticated returns user: null
    const noAuthRes = await request(app).get('/api/v1/auth/me');
    assert.strictEqual(noAuthRes.status, 200);
    assert.strictEqual(noAuthRes.body.data.user, null);

    // Authenticated
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    const authCookie = loginRes.headers['set-cookie'][0];

    const authRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie);
    assert.strictEqual(authRes.status, 200);
    assert.ok(authRes.body.data.user);
    assert.strictEqual(authRes.body.data.user.email, validUser.email.toLowerCase());
    assert.strictEqual(authRes.body.data.user.password_hash, undefined);
  });

  test('Protected POST route (e.g. creating idea) returns 401 with no cookie, tampered token, or expired token', async () => {
    // 1. No cookie
    const resNoCookie = await request(app)
      .post('/api/v1/ideas')
      .send({ title: 'Test Unauthorized', pitch: 'A test pitch for unauthorized check', description: 'At least twenty characters description here', category: 'Tech' });
    assert.strictEqual(resNoCookie.status, 401);

    // 2. Tampered token
    const resTampered = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', 'ideapulse_token=invalid.tampered.token')
      .send({ title: 'Test Tampered Token', pitch: 'A test pitch for tampered check', description: 'At least twenty characters description here', category: 'Tech' });
    assert.strictEqual(resTampered.status, 401);

    // 3. Expired token
    const expiredToken = jwt.sign(
      { id: 999999, email: 'expired@test.com' },
      env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const resExpired = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', `ideapulse_token=${expiredToken}`)
      .send({ title: 'Test Expired Token', pitch: 'A test pitch for expired check', description: 'At least twenty characters description here', category: 'Tech' });
    assert.strictEqual(resExpired.status, 401);
  });

  test('Logout clears the auth cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies);
    const authCookie = cookies.find(c => c.includes('ideapulse_token='));
    assert.ok(authCookie);
    // Cookie is cleared with empty value or expires in the past
    assert.ok(authCookie.includes('ideapulse_token=;') || authCookie.includes('Expires=Thu, 01 Jan 1970'));
  });
});
