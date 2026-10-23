import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';

describe('Ratings Supertest Suite (Validation, Self-Rating, Upsert, Concurrency, Stats)', () => {
  let author, reviewer, otherReviewer;
  let authorCookie, reviewerCookie, otherReviewerCookie;
  let testIdeaId;

  before(async () => {
    await runMigrations();
    const now = Date.now();

    // 1. Author
    const resAuthor = await request(app).post('/api/v1/auth/register').send({
      name: 'Author User',
      email: `rating_author_${now}@test.com`,
      password: 'Password123!'
    });
    author = resAuthor.body.data.user;
    authorCookie = resAuthor.headers['set-cookie'][0];

    // 2. Reviewer 1
    const resReviewer = await request(app).post('/api/v1/auth/register').send({
      name: 'Reviewer One',
      email: `reviewer_1_${now}@test.com`,
      password: 'Password123!'
    });
    reviewer = resReviewer.body.data.user;
    reviewerCookie = resReviewer.headers['set-cookie'][0];

    // 3. Reviewer 2
    const resOtherReviewer = await request(app).post('/api/v1/auth/register').send({
      name: 'Reviewer Two',
      email: `reviewer_2_${now}@test.com`,
      password: 'Password123!'
    });
    otherReviewer = resOtherReviewer.body.data.user;
    otherReviewerCookie = resOtherReviewer.headers['set-cookie'][0];

    // Author creates an idea
    const resIdea = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', authorCookie)
      .send({
        title: 'Rating Target Idea',
        pitch: 'Idea designed exclusively to test comprehensive ratings flow',
        description: 'Detailed description exceeding the twenty character requirement for ideas.',
        category: 'Design'
      });
    testIdeaId = resIdea.body.data.idea.id;
  });

  after(async () => {
    if (testIdeaId) {
      await db.prepare('DELETE FROM ideas WHERE id = ?').run(testIdeaId);
    }
    if (author) {
      await db.prepare('DELETE FROM users WHERE id IN (?, ?, ?)').run(author.id, reviewer.id, otherReviewer.id);
    }
  });

  test('Unauthenticated user cannot rate (returns 401)', async () => {
    const res = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/ratings`)
      .send({ score: 5, review_text: 'Unauth attempt' });
    assert.strictEqual(res.status, 401);
  });

  test('Author cannot rate their own idea (returns 400 with clear message)', async () => {
    const res = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', authorCookie)
      .send({ score: 5, review_text: 'Self rating attempt' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error.message, /cannot rate your own idea/i);
  });

  test('Score validation rejects 0, 6, 3.5, "abc", null, and missing score with 400', async () => {
    const invalidScores = [0, 6, 3.5, 'abc', null, undefined];

    for (const score of invalidScores) {
      const payload = score === undefined ? { review_text: 'Missing score' } : { score, review_text: 'Invalid score' };
      const res = await request(app)
        .post(`/api/v1/ideas/${testIdeaId}/ratings`)
        .set('Cookie', reviewerCookie)
        .send(payload);

      assert.strictEqual(res.status, 400, `Expected 400 for invalid score: ${score}`);
      assert.strictEqual(res.body.success, false);
    }
  });

  test('Submitting valid rating creates record and updates stats accurately', async () => {
    const res = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', reviewerCookie)
      .send({ score: 5, review_text: 'Outstanding concept!' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.rating.score, 5);
    assert.strictEqual(res.body.data.stats.total_ratings, 1);
    assert.strictEqual(res.body.data.stats.avg_score, 5.0);
  });

  test('Re-rating updates existing rating, never duplicates', async () => {
    // Reviewer updates rating from 5 to 3
    const res = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', reviewerCookie)
      .send({ score: 3, review_text: 'Re-evaluated to 3 stars' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.rating.score, 3);
    assert.strictEqual(res.body.data.stats.total_ratings, 1);
    assert.strictEqual(res.body.data.stats.avg_score, 3.0);

    // Verify in database that only 1 record exists for this user and idea
    const row = await db.prepare('SELECT COUNT(*) as count FROM ratings WHERE user_id = ? AND idea_id = ?').get(reviewer.id, testIdeaId);
    assert.strictEqual(Number(row.count), 1);
  });

  test('Two simultaneous rating requests update cleanly without duplicate insert', async () => {
    const [reqA, reqB] = await Promise.all([
      request(app)
        .post(`/api/v1/ideas/${testIdeaId}/ratings`)
        .set('Cookie', reviewerCookie)
        .send({ score: 4, review_text: 'Concurrent rate A' }),
      request(app)
        .post(`/api/v1/ideas/${testIdeaId}/ratings`)
        .set('Cookie', reviewerCookie)
        .send({ score: 5, review_text: 'Concurrent rate B' })
    ]);

    assert.ok(reqA.status === 200);
    assert.ok(reqB.status === 200);

    const countRow = await db.prepare('SELECT COUNT(*) as count FROM ratings WHERE user_id = ? AND idea_id = ?').get(reviewer.id, testIdeaId);
    assert.strictEqual(Number(countRow.count), 1);
  });

  test('Multiple reviewers update average score and distribution accurately', async () => {
    // Reviewer 1 rates 4
    await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', reviewerCookie)
      .send({ score: 4, review_text: 'Reviewer 1 rates 4' });

    // Reviewer 2 rates 2
    const res2 = await request(app)
      .post(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', otherReviewerCookie)
      .send({ score: 2, review_text: 'Reviewer 2 rates 2' });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.data.stats.total_ratings, 2);
    // (4 + 2) / 2 = 3.0
    assert.strictEqual(res2.body.data.stats.avg_score, 3.0);
    assert.strictEqual(res2.body.data.stats.distribution[4], 1);
    assert.strictEqual(res2.body.data.stats.distribution[2], 1);
  });

  test('Delete rating updates stats; zero-ratings idea returns clean value without NaN or null crash', async () => {
    // Reviewer 2 deletes rating
    const delRes2 = await request(app)
      .delete(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', otherReviewerCookie);
    assert.strictEqual(delRes2.status, 200);
    assert.strictEqual(delRes2.body.data.stats.total_ratings, 1);
    assert.strictEqual(delRes2.body.data.stats.avg_score, 4.0);

    // Reviewer 1 deletes last rating
    const delRes1 = await request(app)
      .delete(`/api/v1/ideas/${testIdeaId}/ratings`)
      .set('Cookie', reviewerCookie);
    assert.strictEqual(delRes1.status, 200);
    assert.strictEqual(delRes1.body.data.stats.total_ratings, 0);
    assert.strictEqual(delRes1.body.data.stats.avg_score, 0.0);
    assert.strictEqual(isNaN(delRes1.body.data.stats.avg_score), false);

    // Verify getting idea with 0 ratings returns clean stats
    const ideaRes = await request(app).get(`/api/v1/ideas/${testIdeaId}`);
    assert.strictEqual(ideaRes.status, 200);
    assert.strictEqual(ideaRes.body.data.idea.stats.total_ratings, 0);
    assert.strictEqual(ideaRes.body.data.idea.stats.avg_score, 0.0);
    assert.strictEqual(isNaN(ideaRes.body.data.idea.stats.avg_score), false);
  });
});
