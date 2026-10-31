import db from '../config/db.js';
import {
  weightedRatingsSql,
  RANKING_SCORE_SQL,
  DEMAND_TOTALS_SQL,
  MIN_RATINGS_TO_RANK,
  rankingStats,
  displayAuthor
} from '../services/ranking.js';

// Top Today / Week / Month / All time: the same weighted score, counting only ratings cast in the window.
// An idea needs MIN_RATINGS_TO_RANK ratings inside the window to appear at all.
export async function getLeaderboard(req, res, next) {
  try {
    const { timeframe = 'all', limit = 20 } = req.query;
    const tf = (timeframe || 'all').toLowerCase();
    let timeFilter = '';
    if (tf === 'daily' || tf === 'today') {
      timeFilter = "AND r.created_at >= datetime('now', 'start of day')";
    } else if (tf === 'week' || tf === 'weekly') {
      timeFilter = "AND r.created_at >= datetime('now', '-7 days')";
    } else if (tf === 'month' || tf === 'monthly') {
      timeFilter = "AND r.created_at >= datetime('now', '-30 days')";
    }

    const sql = `
      SELECT
        i.id,
        i.title,
        i.pitch,
        i.category,
        i.created_at,
        i.is_team_seed,
        u.id AS author_id,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        ws.n AS ws_n,
        ROUND(COALESCE(ws.raw_avg, 0.0), 2) AS avg_score,
        ${RANKING_SCORE_SQL} AS ranking_score,
        dm.demand_votes,
        dm.would_pay_votes,
        (
          SELECT json_group_array(t.name)
          FROM idea_tags it
          JOIN tags t ON it.tag_id = t.id
          WHERE it.idea_id = i.id
        ) AS tags_json
      FROM ideas i
      JOIN users u ON i.user_id = u.id
      JOIN (
        SELECT idea_id, n, wsum, wscore, raw_avg FROM (
          ${weightedRatingsSql(timeFilter).replace('COUNT(*) AS n,', 'COUNT(*) AS n, AVG(CAST(r.score AS REAL)) AS raw_avg,')}
        )
      ) ws ON ws.idea_id = i.id
      LEFT JOIN (${DEMAND_TOTALS_SQL}) dm ON dm.idea_id = i.id
      WHERE ws.n >= ${MIN_RATINGS_TO_RANK}
      ORDER BY ranking_score DESC, ws.n DESC, i.created_at DESC, i.id ASC
      LIMIT ?
    `;

    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const rows = await db.prepare(sql).all(safeLimit);

    const leaderboard = rows.map((r, index) => ({
      rank: index + 1,
      id: r.id,
      title: r.title,
      pitch: r.pitch,
      category: r.category,
      created_at: r.created_at,
      is_team_seed: Boolean(Number(r.is_team_seed)),
      author: displayAuthor(r),
      stats: {
        avg_score: Number(r.avg_score),
        total_ratings: Number(r.ws_n),
        ...rankingStats(r)
      },
      tags: r.tags_json ? JSON.parse(r.tags_json).filter(Boolean) : []
    }));

    res.json({
      success: true,
      data: {
        timeframe,
        min_ratings: MIN_RATINGS_TO_RANK,
        leaderboard
      }
    });
  } catch (err) {
    next(err);
  }
}
