import db from '../config/db.js';
import { isVoteBurst } from '../services/ranking.js';

export async function getIdeaRatings(req, res, next) {
  try {
    const ideaId = Number(req.params.id);

    const ratingsSql = `
      SELECT
        r.id,
        r.score,
        r.review_text,
        r.created_at,
        r.updated_at,
        u.id AS user_id,
        u.name AS user_name,
        u.avatar_url AS user_avatar
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.idea_id = ? AND r.held = 0
      ORDER BY r.created_at DESC
    `;

    const rows = await db.prepare(ratingsSql).all(ideaId);
    const ratings = rows.map(r => ({
      id: r.id,
      score: r.score,
      review_text: r.review_text,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user: {
        id: r.user_id,
        name: r.user_name,
        avatar_url: r.user_avatar
      }
    }));

    res.json({
      success: true,
      data: { ratings }
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyIdeaRating(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const userId = req.user.id;

    const rating = await db.prepare(`
      SELECT id, score, review_text, created_at, updated_at
      FROM ratings
      WHERE idea_id = ? AND user_id = ?
    `).get(ideaId, userId);

    res.json({
      success: true,
      data: { rating: rating || null }
    });
  } catch (err) {
    next(err);
  }
}

export async function submitOrUpdateRating(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const userId = req.user.id;
    const { score, review_text } = req.body;

    // Check if idea exists
    const idea = await db.prepare('SELECT id, user_id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({
        success: false,
        error: { message: 'Idea not found.' }
      });
    }

    // Business rule: Users cannot rate their own idea
    if (idea.user_id === userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'You cannot rate your own idea.' }
      });
    }

    // Upsert rating: One rating per user per idea
    const existing = await db.prepare('SELECT held FROM ratings WHERE idea_id = ? AND user_id = ?').get(ideaId, userId);
    // A first rating in a burst of new accounts is held for admin review and not counted until released.
    const held = existing ? Number(existing.held) : ((await isVoteBurst('ratings', ideaId, userId)) ? 1 : 0);

    const upsertSql = `
      INSERT INTO ratings (user_id, idea_id, score, review_text, held, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, idea_id) DO UPDATE SET
        score = excluded.score,
        review_text = excluded.review_text,
        updated_at = CURRENT_TIMESTAMP
    `;

    await db.prepare(upsertSql).run(userId, ideaId, score, review_text || null, held);

    // Fetch updated stats from SQL view
    const updatedStats = await db.prepare(`
      SELECT
        avg_score,
        total_ratings,
        score_5_count,
        score_4_count,
        score_3_count,
        score_2_count,
        score_1_count
      FROM idea_stats_view
      WHERE idea_id = ?
    `).get(ideaId);

    const userRating = await db.prepare(`
      SELECT id, score, review_text, held, created_at, updated_at
      FROM ratings
      WHERE idea_id = ? AND user_id = ?
    `).get(ideaId, userId);

    res.json({
      success: true,
      message: held ? 'Rating saved. It will count once it is reviewed.' : 'Rating saved successfully.',
      data: {
        rating: userRating,
        stats: {
          avg_score: Number(updatedStats?.avg_score || 0),
          total_ratings: Number(updatedStats?.total_ratings || 0),
          distribution: {
            5: Number(updatedStats?.score_5_count || 0),
            4: Number(updatedStats?.score_4_count || 0),
            3: Number(updatedStats?.score_3_count || 0),
            2: Number(updatedStats?.score_2_count || 0),
            1: Number(updatedStats?.score_1_count || 0)
          }
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteRating(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const userId = req.user.id;

    const result = await db.prepare('DELETE FROM ratings WHERE idea_id = ? AND user_id = ?').run(ideaId, userId);
    if (result.changes === 0 && result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'No rating found to delete.' }
      });
    }

    const updatedStats = await db.prepare(`
      SELECT
        avg_score,
        total_ratings,
        score_5_count,
        score_4_count,
        score_3_count,
        score_2_count,
        score_1_count
      FROM idea_stats_view
      WHERE idea_id = ?
    `).get(ideaId);

    res.json({
      success: true,
      message: 'Rating removed successfully.',
      data: {
        stats: {
          avg_score: Number(updatedStats?.avg_score || 0),
          total_ratings: Number(updatedStats?.total_ratings || 0),
          distribution: {
            5: Number(updatedStats?.score_5_count || 0),
            4: Number(updatedStats?.score_4_count || 0),
            3: Number(updatedStats?.score_3_count || 0),
            2: Number(updatedStats?.score_2_count || 0),
            1: Number(updatedStats?.score_1_count || 0)
          }
        }
      }
    });
  } catch (err) {
    next(err);
  }
}
