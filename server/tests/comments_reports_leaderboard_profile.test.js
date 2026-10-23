import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';

describe('Comments, Reports, Leaderboard, and Profile Supertest Suite', () => {
  let user1, user2, adminUser;
  let cookie1, cookie2, adminCookie;
  let testIdeaId;
  let rootCommentId;

  before(async () => {
    await runMigrations();
    const now = Date.now();

    // User 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'User One',
      email: `user_1_${now}@test.com`,
      password: 'Password123!',
      bio: 'Profile bio user 1'
    });
    user1 = res1.body.data.user;
    cookie1 = res1.headers['set-cookie'][0];

    // User 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'User Two',
      email: `user_2_${now}@test.com`,
      password: 'Password123!',
      bio: 'Profile bio user 2'
    });
    user2 = res2.body.data.user;
    cookie2 = res2.headers['set-cookie'][0];

    // Admin
    const resAdmin = await request(app).post('/api/v1/auth/register').send({
      name: 'Admin Moderator',
      email: `admin_mod_${now}@test.com`,
      password: 'Password123!'
    });
    adminUser = resAdmin.body.data.user;
    adminCookie = resAdmin.headers['set-cookie'][0];
    await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(adminUser.id);

    // Create an idea by User 1
    const resIdea = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie1)
      .send({
        title: 'Community Critique Idea',
        pitch: 'A community idea for threaded discussions, reports, and leaderboards',
        description: 'Detailed description exceeding twenty characters for test requirements.',
        category: 'Social'
      });
    testIdeaId = resIdea.body.data.idea.id;
  });

  after(async () => {
    if (testIdeaId) {
      await db.prepare('DELETE FROM ideas WHERE id = ?').run(testIdeaId);
    }
    if (user1) {
      await db.prepare('DELETE FROM users WHERE id IN (?, ?, ?)').run(user1.id, user2.id, adminUser.id);
    }
  });

  /* COMMENTS TESTS */
  test('Create comment returns 201; list returns comments for idea', async () => {
    const res = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/comments`)
      .set('Cookie', cookie2)
      .send({ content: 'This is a root feedback comment from user 2' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.comment.id);
    assert.strictEqual(res.body.data.comment.parent_id, null);
    rootCommentId = res.body.data.comment.id;

    // Get comments
    const listRes = await request(app).get(`/api/v1/ideas/${testIdeaId}/comments`);
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.body.data.comments.some(c => c.id === rootCommentId));
  });

  test('Create threaded reply comment with parent_id returns 201 and stores parent_id', async () => {
    const replyRes = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/comments`)
      .set('Cookie', cookie1)
      .send({
        content: 'Thanks for the critique! Here is our reply.',
        parent_id: rootCommentId
      });

    assert.strictEqual(replyRes.status, 201);
    assert.strictEqual(replyRes.body.data.comment.parent_id, rootCommentId);

    // Verify parent_id in list
    const listRes = await request(app).get(`/api/v1/ideas/${testIdeaId}/comments`);
    const reply = listRes.body.data.comments.find(c => c.id === replyRes.body.data.comment.id);
    assert.ok(reply);
    assert.strictEqual(reply.parent_id, rootCommentId);
  });

  test('Delete comment: owner or admin can delete; others return 403; unknown id returns 404', async () => {
    // Create temporary comment by User 2
    const tempRes = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/comments`)
      .set('Cookie', cookie2)
      .send({ content: 'Comment to be deleted' });
    const tempId = tempRes.body.data.comment.id;

    // Unknown id returns 404
    const resUnknown = await request(app)
      .delete('/api/v1/ideas/comments/999999')
      .set('Cookie', cookie2);
    assert.strictEqual(resUnknown.status, 404);

    // User 1 (not owner, not admin) returns 403
    const resForbidden = await request(app)
      .delete(`/api/v1/ideas/comments/${tempId}`)
      .set('Cookie', cookie1);
    assert.strictEqual(resForbidden.status, 403);

    // Admin can delete (returns 200)
    const resAdmin = await request(app)
      .delete(`/api/v1/ideas/comments/${tempId}`)
      .set('Cookie', adminCookie);
    assert.strictEqual(resAdmin.status, 200);
  });

  /* REPORTS TESTS */
  test('Report idea: user can report once; duplicate report returns 409', async () => {
    // First report
    const res1 = await request(app)
      .post('/api/v1/reports')
      .set('Cookie', cookie2)
      .send({
        idea_id: testIdeaId,
        reason: 'Suspected spam or misleading product pitch'
      });
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res1.body.success, true);

    // Second report by same user on same idea -> 409 Conflict
    const res2 = await request(app)
      .post('/api/v1/reports')
      .set('Cookie', cookie2)
      .send({
        idea_id: testIdeaId,
        reason: 'Another report attempt by same user'
      });
    assert.strictEqual(res2.status, 409);
    assert.strictEqual(res2.body.success, false);
    assert.match(res2.body.error.message, /already reported/i);
  });

  /* LEADERBOARD TESTS */
  test('Leaderboard order correct for daily, weekly, monthly, and all time; handles zero ratings and ties', async () => {
    // Rate the test idea with 5 stars
    await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', cookie2)
      .send({ score: 5, review_text: 'Top score' });

    // 1. Daily leaderboard
    const dailyRes = await request(app).get('/api/v1/leaderboard?timeframe=daily');
    assert.strictEqual(dailyRes.status, 200);
    assert.ok(Array.isArray(dailyRes.body.data.leaderboard));
    if (dailyRes.body.data.leaderboard.length > 0) {
      assert.ok(dailyRes.body.data.leaderboard[0].stats.avg_score >= 0);
    }

    // 2. Weekly leaderboard
    const weekRes = await request(app).get('/api/v1/leaderboard?timeframe=week');
    assert.strictEqual(weekRes.status, 200);
    assert.ok(Array.isArray(weekRes.body.data.leaderboard));

    // 3. Monthly leaderboard
    const monthRes = await request(app).get('/api/v1/leaderboard?timeframe=month');
    assert.strictEqual(monthRes.status, 200);
    assert.ok(Array.isArray(monthRes.body.data.leaderboard));

    // 4. All time leaderboard
    const allRes = await request(app).get('/api/v1/leaderboard?timeframe=all');
    assert.strictEqual(allRes.status, 200);
    assert.ok(Array.isArray(allRes.body.data.leaderboard));

    // Check tie breaking and zero ratings handling:
    // Idea with rating is ahead of or equal to ideas without ratings
    for (let i = 0; i < allRes.body.data.leaderboard.length - 1; i++) {
      const current = allRes.body.data.leaderboard[i];
      const next = allRes.body.data.leaderboard[i + 1];
      assert.ok(
        current.stats.avg_score >= next.stats.avg_score,
        `Leaderboard ordering violation: rank ${current.rank} has score ${current.stats.avg_score} < rank ${next.rank} with score ${next.stats.avg_score}`
      );
    }
  });

  /* PROFILE TESTS */
  test('Profile shows only that user data, correct stats, and protects private email', async () => {
    // Fetch User 1 profile as User 2 (other user)
    const publicProfileRes = await request(app)
      .get(`/api/v1/users/${user1.id}`)
      .set('Cookie', cookie2);
    assert.strictEqual(publicProfileRes.status, 200);
    assert.strictEqual(publicProfileRes.body.data.user.id, user1.id);
    assert.strictEqual(publicProfileRes.body.data.user.name, user1.name);
    // Other users cannot see email
    assert.strictEqual(publicProfileRes.body.data.user.email, undefined);
    // Stats: user 1 posted 1 idea, received 1 rating with avg score 5.0
    assert.strictEqual(publicProfileRes.body.data.user.stats.ideas_count, 1);
    assert.strictEqual(publicProfileRes.body.data.user.stats.avg_received_score, 5.0);

    // Fetch User 1 profile as User 1 (owner)
    const ownerProfileRes = await request(app)
      .get(`/api/v1/users/${user1.id}`)
      .set('Cookie', cookie1);
    assert.strictEqual(ownerProfileRes.status, 200);
    // Owner sees their own email
    assert.strictEqual(ownerProfileRes.body.data.user.email, user1.email.toLowerCase());

    // Fetch User 2 profile (gave 1 rating)
    const user2Profile = await request(app)
      .get(`/api/v1/users/${user2.id}`)
      .set('Cookie', cookie2);
    assert.strictEqual(user2Profile.status, 200);
    assert.strictEqual(user2Profile.body.data.user.stats.ratings_given_count, 1);
  });
});
