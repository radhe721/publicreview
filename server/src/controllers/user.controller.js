import db from '../config/db.js';

export async function getUserProfile(req, res, next) {
  try {
    const userId = Number(req.params.id);

    const user = await db.prepare(`
      SELECT id, name, email, role, avatar_url, bio, created_at
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found.' }
      });
    }

    // Stats
    const stats = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM ideas WHERE user_id = ?) AS ideas_count,
        (SELECT COUNT(*) FROM ratings WHERE user_id = ?) AS ratings_given_count,
        (
          SELECT ROUND(COALESCE(AVG(CAST(r.score AS REAL)), 0.0), 2)
          FROM ratings r
          JOIN ideas i ON r.idea_id = i.id
          WHERE i.user_id = ?
        ) AS avg_received_score,
        (
          SELECT COUNT(r.id)
          FROM ratings r
          JOIN ideas i ON r.idea_id = i.id
          WHERE i.user_id = ?
        ) AS total_received_ratings
    `).get(userId, userId, userId, userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
          bio: user.bio,
          created_at: user.created_at,
          // Only show email if user is looking at own profile or is admin
          email: (req.user && (req.user.id === user.id || req.user.role === 'admin')) ? user.email : undefined,
          stats: {
            ideas_count: Number(stats?.ideas_count || 0),
            ratings_given_count: Number(stats?.ratings_given_count || 0),
            avg_received_score: Number(stats?.avg_received_score || 0),
            total_received_ratings: Number(stats?.total_received_ratings || 0)
          }
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserIdeas(req, res, next) {
  try {
    const userId = Number(req.params.id);

    const sql = `
      SELECT
        i.id,
        i.title,
        i.pitch,
        i.description,
        i.category,
        i.created_at,
        COALESCE(s.avg_score, 0.0) AS avg_score,
        COALESCE(s.total_ratings, 0) AS total_ratings,
        COALESCE(s.comments_count, 0) AS comments_count,
        (
          SELECT json_group_array(t.name)
          FROM idea_tags it
          JOIN tags t ON it.tag_id = t.id
          WHERE it.idea_id = i.id
        ) AS tags_json
      FROM ideas i
      LEFT JOIN idea_stats_view s ON i.id = s.idea_id
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
    `;

    const rows = await db.prepare(sql).all(userId);
    const ideas = rows.map(r => ({
      id: r.id,
      title: r.title,
      pitch: r.pitch,
      description: r.description,
      category: r.category,
      created_at: r.created_at,
      stats: {
        avg_score: Number(r.avg_score),
        total_ratings: Number(r.total_ratings),
        comments_count: Number(r.comments_count)
      },
      tags: r.tags_json ? JSON.parse(r.tags_json).filter(Boolean) : []
    }));

    res.json({
      success: true,
      data: { ideas }
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserRatings(req, res, next) {
  try {
    const userId = Number(req.params.id);

    const sql = `
      SELECT
        r.id AS rating_id,
        r.score,
        r.review_text,
        r.created_at AS rated_at,
        i.id AS idea_id,
        i.title AS idea_title,
        i.category AS idea_category,
        u.id AS idea_author_id,
        u.name AS idea_author_name
      FROM ratings r
      JOIN ideas i ON r.idea_id = i.id
      JOIN users u ON i.user_id = u.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `;

    const rows = await db.prepare(sql).all(userId);
    const ratings = rows.map(r => ({
      id: r.rating_id,
      score: r.score,
      review_text: r.review_text,
      created_at: r.rated_at,
      idea: {
        id: r.idea_id,
        title: r.idea_title,
        category: r.idea_category,
        author: {
          id: r.idea_author_id,
          name: r.idea_author_name
        }
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
