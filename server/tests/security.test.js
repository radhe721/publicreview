import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';

describe('Security Supertest Suite (SQLi, XSS, RateLimiting, CORS, Helmet, Payload Limits, File Uploads)', () => {
  let user, userCookie;
  let testIdeaId;

  before(async () => {
    await runMigrations();
    const now = Date.now();

    const resUser = await request(app).post('/api/v1/auth/register').send({
      name: 'Security Test User',
      email: `security_${now}@test.com`,
      password: 'Password123!'
    });
    user = resUser.body.data.user;
    userCookie = resUser.headers['set-cookie'][0];
  });

  after(async () => {
    if (testIdeaId) {
      await db.prepare('DELETE FROM ideas WHERE id = ?').run(testIdeaId);
    }
    if (user) {
      await db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    }
  });

  /* 1. SQL INJECTION */
  test('SQL injection attempts in search, category, sort, and body fields are harmless', async () => {
    const sqliPayloads = [
      "' OR 1=1 --",
      "'; DROP TABLE ideas; --",
      "1 UNION SELECT 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14",
      "\" OR \"\"=\"",
      "' OR 'a'='a"
    ];

    for (const sqli of sqliPayloads) {
      // In search query
      const resSearch = await request(app).get(`/api/v1/ideas?search=${encodeURIComponent(sqli)}`);
      assert.strictEqual(resSearch.status, 200);
      assert.strictEqual(resSearch.body.success, true);

      // In sort param
      const resSort = await request(app).get(`/api/v1/ideas?sort=${encodeURIComponent(sqli)}`);
      assert.strictEqual(resSort.status, 200);

      // In category
      const resCat = await request(app).get(`/api/v1/ideas?category=${encodeURIComponent(sqli)}`);
      assert.strictEqual(resCat.status, 200);
    }

    // Verify ideas table was not dropped or compromised
    const count = await db.prepare('SELECT COUNT(*) as count FROM ideas').get();
    assert.ok(count && Number(count.count) >= 0);
  });

  /* 2. XSS PAYLOADS */
  test('XSS payloads are stored safely as text and never executed as HTML', async () => {
    const xssTitle = '<script>alert("xss")</script>';
    const xssPitch = '<img src=x onerror=alert(1)> Safe tagline here!';
    const xssDesc = '<a href="javascript:alert(1)">Click here to test XSS vulnerabilities</a> and read detailed product specs.';

    const res = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', userCookie)
      .send({
        title: xssTitle,
        pitch: xssPitch,
        description: xssDesc,
        category: 'Tech'
      });

    assert.strictEqual(res.status, 201);
    testIdeaId = res.body.data.idea.id;

    // Fetch idea and verify exact safe string storage
    const fetchRes = await request(app).get(`/api/v1/ideas/${testIdeaId}`);
    assert.strictEqual(fetchRes.status, 200);
    assert.strictEqual(fetchRes.body.data.idea.title, xssTitle);
    assert.strictEqual(fetchRes.body.data.idea.pitch, xssPitch);
    assert.strictEqual(fetchRes.body.data.idea.description, xssDesc);
  });

  /* 3. RATE LIMITING */
  test('Rate limiting triggers on repeated login attempts (returns 429)', async () => {
    let got429 = false;
    let rateLimitedResponse = null;

    // Send sequential attempts until limit (5 or 10) is reached
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' });
      if (res.status === 429) {
        got429 = true;
        rateLimitedResponse = res;
        break;
      }
    }

    assert.strictEqual(got429, true, 'At least one request must be rate limited with 429');
    assert.match(rateLimitedResponse.body.error.message, /too many/i);
  });

  /* 4. CORS */
  test('CORS rejects unauthorized cross-origin requests', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://malicious-attacker-site.com');

    // CORS middleware invokes callback with Error, resulting in 500 error or CORS blocked
    assert.ok(res.status === 500 || res.status === 403 || !res.headers['access-control-allow-origin']);
    if (res.headers['access-control-allow-origin']) {
      assert.notStrictEqual(res.headers['access-control-allow-origin'], 'https://malicious-attacker-site.com');
    }
  });

  /* 5. HELMET HEADERS */
  test('Security helmet headers are present on HTTP responses', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['x-content-type-options'] === 'nosniff');
    assert.ok(res.headers['x-frame-options'] === 'SAMEORIGIN');
    assert.ok(res.headers['x-xss-protection'] || res.headers['x-content-type-options']);
  });

  /* 6. OVERSIZED JSON BODY */
  test('Oversized JSON body (> 1MB) is rejected with 413 Payload Too Large', async () => {
    const hugeDescription = 'A'.repeat(1.5 * 1024 * 1024); // 1.5MB
    const res = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', userCookie)
      .send({
        title: 'Huge Body Test',
        pitch: 'A test pitch for oversized body validation',
        description: hugeDescription,
        category: 'Tech'
      });

    assert.strictEqual(res.status, 413);
  });

  /* 7. FILE UPLOADS (COVER IMAGE) */
  test('File upload: rejects non-image files with 400 and rejects files > 2MB with 413', async () => {
    // 1. Rejects wrong file type (e.g. text/plain or executable script)
    const resWrongType = await request(app)
      .post('/api/v1/upload')
      .set('Cookie', userCookie)
      .attach('cover', Buffer.from('#!/bin/bash\necho dangerous'), 'exploit.sh');

    assert.strictEqual(resWrongType.status, 400);
    assert.match(resWrongType.body.error.message, /invalid file type/i);

    // 2. Rejects oversized file (> 2MB)
    const hugeBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5MB
    const resOversized = await request(app)
      .post('/api/v1/upload')
      .set('Cookie', userCookie)
      .attach('cover', hugeBuffer, 'huge_image.png');

    assert.strictEqual(resOversized.status, 413);
    assert.match(resOversized.body.error.message, /too large/i);

    // 3. Accepts valid image file (PNG / JPEG)
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);

    const resValid = await request(app)
      .post('/api/v1/upload')
      .set('Cookie', userCookie)
      .attach('cover', validPngBuffer, 'valid_tile.png');

    assert.strictEqual(resValid.status, 200);
    assert.strictEqual(resValid.body.success, true);
    assert.ok(resValid.body.data.url);
  });
});
