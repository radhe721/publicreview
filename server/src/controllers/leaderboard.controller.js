import db from '../config/db.js';

export async function getLeaderboard(req, res, next) {
  try {
    const { timeframe = 'all', limit = 20 } = req.query;
    const tf = (timeframe || 'all').toLowerCase();
    let timeFilter = '';
    if (tf === 'daily' || tf === 'today') {
      timeFilter = "AND r.created_at >= datetime('now', 'start of day', 'localtime')";
    } else if (tf === 'week' || tf === 'weekly') {
      timeFilter = "AND r.created_at >= datetime('now', '-7 days', 'localtime')";
    } else if (tf === 'month' || tf === 'monthly') {
      timeFilter = "AND r.created_at >= datetime('now', '-30 days', 'localtime')";
    }

    const sql = `
      SELECT
        i.id,
        i.title,
        i.pitch,
        i.category,
        i.created_at,
        u.id AS author_id,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        COUNT(r.id) AS total_ratings,
        COALESCE(ROUND(AVG(CAST(r.score AS REAL)), 2), 0.0) AS avg_score,
        (
          SELECT json_group_array(t.name)
          FROM idea_tags it
          JOIN tags t ON it.tag_id = t.id
          WHERE it.idea_id = i.id
        ) AS tags_json
      FROM ideas i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN ratings r ON i.id = r.idea_id ${timeFilter}
      GROUP BY i.id
      ORDER BY avg_score DESC, total_ratings DESC, i.created_at DESC, i.id ASC
      LIMIT ?
    `;

    const rows = await db.prepare(sql).all(Number(limit) || 20);

    const leaderboard = rows.map((r, index) => ({
      rank: index + 1,
      id: r.id,
      title: r.title,
      pitch: r.pitch,
      category: r.category,
      created_at: r.created_at,
      author: {
        id: r.author_id,
        name: r.author_name,
        avatar_url: r.author_avatar
      },
      stats: {
        avg_score: Number(r.avg_score),
        total_ratings: Number(r.total_ratings)
      },
      tags: r.tags_json ? JSON.parse(r.tags_json).filter(Boolean) : []
    }));

    res.json({
      success: true,
      data: {
        timeframe,
        leaderboard
      }
    });
  } catch (err) {
    next(err);
  }
}
