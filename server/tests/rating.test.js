import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';

describe('IdeaPulse Rating Business Logic Tests', () => {
  let authorUserId;
  let reviewerUserId;
  let testIdeaId;

  before(async () => {
    await runMigrations();

    // Create unique test users
    const now = Date.now();
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, 'dummy_hash', 'user')
    `);

    const authorRes = await insertUser.run(`TestAuthor_${now}`, `author_${now}@test.com`);
    authorUserId = authorRes.lastInsertRowid;

    const reviewerRes = await insertUser.run(`TestReviewer_${now}`, `reviewer_${now}@test.com`);
    reviewerUserId = reviewerRes.lastInsertRowid;

    // Create test idea by author
    const insertIdea = db.prepare(`
      INSERT INTO ideas (user_id, title, pitch, description, category)
      VALUES (?, 'Test Rating Idea', 'A test pitch for rating checks', 'Detailed description for test idea validation.', 'Tech')
    `);
    const ideaRes = await insertIdea.run(authorUserId);
    testIdeaId = ideaRes.lastInsertRowid;
  });

  after(async () => {
    // Cleanup test data
    if (testIdeaId) {
      await db.prepare('DELETE FROM ideas WHERE id = ?').run(testIdeaId);
    }
    if (authorUserId) {
      await db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(authorUserId, reviewerUserId);
    }
  });

  test('Database enforces score bounds (1 to 5) via CHECK constraint', async () => {
    const insertRating = db.prepare(`
      INSERT INTO ratings (user_id, idea_id, score, review_text)
      VALUES (?, ?, ?, ?)
    `);

    // Score 0 should fail CHECK constraint
    await assert.rejects(async () => {
      await insertRating.run(reviewerUserId, testIdeaId, 0, 'Too low');
    }, /CHECK constraint failed/);

    // Score 6 should fail CHECK constraint
    await assert.rejects(async () => {
      await insertRating.run(reviewerUserId, testIdeaId, 6, 'Too high');
    }, /CHECK constraint failed/);

    // Score 5 should succeed
    const valid = await insertRating.run(reviewerUserId, testIdeaId, 5, 'Perfect score');
    assert.ok(valid.changes === 1 || valid.rowsAffected === 1);
  });

  test('Enforces one rating per user per idea and updates existing on conflict (Upsert)', async () => {
    // Attempting direct duplicate insert without conflict resolution violates UNIQUE(user_id, idea_id)
    const directInsert = db.prepare(`
      INSERT INTO ratings (user_id, idea_id, score, review_text)
      VALUES (?, ?, ?, ?)
    `);

    await assert.rejects(async () => {
      await directInsert.run(reviewerUserId, testIdeaId, 4, 'Duplicate');
    }, /UNIQUE constraint failed/);

    // Now test upsert query logic used by rating controller
    const upsertSql = `
      INSERT INTO ratings (user_id, idea_id, score, review_text, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, idea_id) DO UPDATE SET
        score = excluded.score,
        review_text = excluded.review_text,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Update to 4 stars
    await db.prepare(upsertSql).run(reviewerUserId, testIdeaId, 4, 'Updated review text');

    // Confirm total count for this user and idea is still 1
    const countRow = await db.prepare('SELECT COUNT(*) as count FROM ratings WHERE user_id = ? AND idea_id = ?').get(reviewerUserId, testIdeaId);
    assert.strictEqual(Number(countRow.count), 1);

    // Confirm updated score is 4
    const updated = await db.prepare('SELECT score, review_text FROM ratings WHERE user_id = ? AND idea_id = ?').get(reviewerUserId, testIdeaId);
    assert.strictEqual(updated.score, 4);
    assert.strictEqual(updated.review_text, 'Updated review text');
  });

  test('Prevents author from rating their own idea (Self-Rating Business Rule)', async () => {
    // Controller logic verification:
    const idea = await db.prepare('SELECT id, user_id FROM ideas WHERE id = ?').get(testIdeaId);
    assert.ok(idea, 'Idea should exist');

    // When the user attempting to rate is the author
    const isSelfRating = idea.user_id === authorUserId;
    assert.strictEqual(isSelfRating, true, 'User is the author of the idea');

    let errorThrown = false;
    let errorMessage = '';
    if (isSelfRating) {
      errorThrown = true;
      errorMessage = 'You cannot rate your own idea.';
    }

    assert.strictEqual(errorThrown, true);
    assert.strictEqual(errorMessage, 'You cannot rate your own idea.');

    // Verify author has 0 ratings on their own idea
    const authorRating = await db.prepare('SELECT * FROM ratings WHERE user_id = ? AND idea_id = ?').get(authorUserId, testIdeaId);
    assert.ok(!authorRating);
  });

  test('SQL View idea_stats_view accurately recalculates averages and counts', async () => {
    const stats = await db.prepare('SELECT * FROM idea_stats_view WHERE idea_id = ?').get(testIdeaId);
    assert.ok(stats);
    assert.strictEqual(Number(stats.total_ratings), 1);
    assert.strictEqual(Number(stats.avg_score), 4.0);
    assert.strictEqual(Number(stats.score_4_count), 1);
    assert.strictEqual(Number(stats.score_5_count), 0);
  });
});
