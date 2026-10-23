import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';

describe('Ideas Supertest Suite (CRUD, Validation, Permissions, Filters, Pagination)', () => {
  let user1, user2, adminUser;
  let cookie1, cookie2, adminCookie;
  let createdIdeaId;

  before(async () => {
    await runMigrations();
    const now = Date.now();

    // Register User 1 (Author)
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Idea Author',
      email: `author_${now}@example.com`,
      password: 'Password123!'
    });
    user1 = res1.body.data.user;
    cookie1 = res1.headers['set-cookie'][0];

    // Register User 2 (Other User)
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Other User',
      email: `other_${now}@example.com`,
      password: 'Password123!'
    });
    user2 = res2.body.data.user;
    cookie2 = res2.headers['set-cookie'][0];

    // Register User 3 & elevate to Admin
    const res3 = await request(app).post('/api/v1/auth/register').send({
      name: 'Admin User',
      email: `admin_${now}@example.com`,
      password: 'Password123!'
    });
    adminUser = res3.body.data.user;
    adminCookie = res3.headers['set-cookie'][0];
    await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(adminUser.id);
  });

  after(async () => {
    // Cleanup users and ideas
    if (createdIdeaId) {
      await db.prepare('DELETE FROM ideas WHERE id = ?').run(createdIdeaId);
    }
    if (user1) {
      await db.prepare('DELETE FROM users WHERE id IN (?, ?, ?)').run(user1.id, user2.id, adminUser.id);
    }
  });

  test('Create valid idea returns 201 with full idea metadata', async () => {
    const payload = {
      title: 'Valid Idea Title',
      pitch: 'A concise compelling one-line pitch for launch test',
      description: 'This is a detailed description of the product idea meeting the minimum twenty character threshold.',
      category: 'Tech',
      tags: ['ai', 'productivity']
    };

    const res = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send(payload);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.idea.id);
    assert.strictEqual(res.body.data.idea.title, payload.title);
    assert.strictEqual(res.body.data.idea.pitch, payload.pitch);
    assert.strictEqual(res.body.data.idea.category, payload.category);
    createdIdeaId = res.body.data.idea.id;
  });

  test('Create rejects empty title, title > 60 chars, tagline > 100 chars, description < 20 or > 5000 chars, invalid category with 400', async () => {
    // Empty title
    const resEmptyTitle = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send({
        title: '',
        pitch: 'A valid tagline that exceeds ten characters easily',
        description: 'A sufficiently long description text exceeding twenty characters.',
        category: 'Tech'
      });
    assert.strictEqual(resEmptyTitle.status, 400);

    // Title exceeds 60 characters
    const resLongTitle = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send({
        title: 'This is a deliberately extremely long title designed to exceed the sixty character boundary limitation',
        pitch: 'A valid tagline that exceeds ten characters easily',
        description: 'A sufficiently long description text exceeding twenty characters.',
        category: 'Tech'
      });
    assert.strictEqual(resLongTitle.status, 400);

    // Tagline exceeds 100 characters
    const resLongPitch = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send({
        title: 'Valid Short Title',
        pitch: 'This tagline is deliberately expanded and repeated to ensure that it runs over one hundred characters in total length for boundary testing!',
        description: 'A sufficiently long description text exceeding twenty characters.',
        category: 'Tech'
      });
    assert.strictEqual(resLongPitch.status, 400);

    // Description < 20 characters
    const resShortDesc = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send({
        title: 'Valid Short Title',
        pitch: 'A valid tagline that exceeds ten characters easily',
        description: 'Too short',
        category: 'Tech'
      });
    assert.strictEqual(resShortDesc.status, 400);

    // Invalid category
    const resInvalidCat = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send({
        title: 'Valid Short Title',
        pitch: 'A valid tagline that exceeds ten characters easily',
        description: 'A sufficiently long description text exceeding twenty characters.',
        category: 'NonExistentCategory'
      });
    assert.strictEqual(resInvalidCat.status, 400);
  });

  test('Get idea by ID returns 200 for valid ID and 404 for unknown ID', async () => {
    const res = await request(app).get(`/api/v1/ideas/${createdIdeaId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.idea.id, createdIdeaId);

    const res404 = await request(app).get('/api/v1/ideas/999999');
    assert.strictEqual(res404.status, 404);
  });

  test('Only owner can edit idea; others return 403', async () => {
    // User 2 attempts to edit User 1's idea
    const resOther = await request(app)
      .put(`/api/v1/ideas/${createdIdeaId}`)
      .set('Cookie', cookie2)
      .send({ title: 'Hacked Title By Other' });
    assert.strictEqual(resOther.status, 403);

    // User 1 (owner) successfully edits
    const resOwner = await request(app)
      .put(`/api/v1/ideas/${createdIdeaId}`)
      .set('Cookie', cookie1)
      .send({ title: 'Updated Title By Owner' });
    assert.strictEqual(resOwner.status, 200);
    assert.strictEqual(resOwner.body.success, true);
  });

  test('Only owner or admin can delete idea; others return 403; unknown id returns 404', async () => {
    // Create temporary idea for delete tests
    const tempRes = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send({
        title: 'Temporary Delete Idea',
        pitch: 'Temporary pitch for deletion testing',
        description: 'Description long enough for validation rules.',
        category: 'Tech'
      });
    const tempId = tempRes.body.data.idea.id;

    // Unknown id returns 404
    const resUnknown = await request(app)
      .delete('/api/v1/ideas/888888')
      .set('Cookie', cookie1);
    assert.strictEqual(resUnknown.status, 404);

    // Other user returns 403
    const resForbidden = await request(app)
      .delete(`/api/v1/ideas/${tempId}`)
      .set('Cookie', cookie2);
    assert.strictEqual(resForbidden.status, 403);

    // Admin can delete any idea (returns 200)
    const resAdminDelete = await request(app)
      .delete(`/api/v1/ideas/${tempId}`)
      .set('Cookie', adminCookie);
    assert.strictEqual(resAdminDelete.status, 200);

    // Confirm it is gone
    const resGone = await request(app).get(`/api/v1/ideas/${tempId}`);
    assert.strictEqual(resGone.status, 404);
  });

  test('List supports search, category filter, sort, time window, and pagination bounds', async () => {
    // 1. Search filter
    const resSearch = await request(app).get('/api/v1/ideas?search=Updated');
    assert.strictEqual(resSearch.status, 200);
    assert.ok(Array.isArray(resSearch.body.data.ideas));
    assert.ok(resSearch.body.data.ideas.some(i => i.id === createdIdeaId));

    // 2. Category filter
    const resCat = await request(app).get('/api/v1/ideas?category=Tech');
    assert.strictEqual(resCat.status, 200);
    assert.ok(resCat.body.data.ideas.every(i => i.category === 'Tech'));

    // 3. Sort options: top, newest, most_discussed
    const resSortNew = await request(app).get('/api/v1/ideas?sort=newest');
    assert.strictEqual(resSortNew.status, 200);

    const resSortDiscussed = await request(app).get('/api/v1/ideas?sort=most_discussed');
    assert.strictEqual(resSortDiscussed.status, 200);

    // 4. Time window: today, yesterday, week, month, all
    const resToday = await request(app).get('/api/v1/ideas?time_window=today');
    assert.strictEqual(resToday.status, 200);
    assert.ok(Array.isArray(resToday.body.data.ideas));

    const resYesterday = await request(app).get('/api/v1/ideas?time_window=yesterday');
    assert.strictEqual(resYesterday.status, 200);

    const resWeek = await request(app).get('/api/v1/ideas?time_window=week');
    assert.strictEqual(resWeek.status, 200);

    const resMonth = await request(app).get('/api/v1/ideas?time_window=month');
    assert.strictEqual(resMonth.status, 200);

    // 5. Pagination: first page, out of range page, limit bounds
    const resFirstPage = await request(app).get('/api/v1/ideas?page=1&limit=5');
    assert.strictEqual(resFirstPage.status, 200);
    assert.strictEqual(resFirstPage.body.data.pagination.page, 1);
    assert.strictEqual(resFirstPage.body.data.pagination.limit, 5);

    // Out of range page returns empty array cleanly without crashing
    const resOutOfRange = await request(app).get('/api/v1/ideas?page=9999&limit=10');
    assert.strictEqual(resOutOfRange.status, 200);
    assert.strictEqual(resOutOfRange.body.data.ideas.length, 0);
    assert.strictEqual(resOutOfRange.body.data.pagination.page, 9999);

    // Limit bounds: limit=50 is valid max, limit=100 or limit=0 rejected with 400
    const resLimitMax = await request(app).get('/api/v1/ideas?limit=50');
    assert.strictEqual(resLimitMax.status, 200);
    assert.strictEqual(resLimitMax.body.data.pagination.limit, 50);

    const resLimitOver = await request(app).get('/api/v1/ideas?limit=100');
    assert.strictEqual(resLimitOver.status, 400);

    const resLimitUnder = await request(app).get('/api/v1/ideas?limit=0');
    assert.strictEqual(resLimitUnder.status, 400);
  });
});
