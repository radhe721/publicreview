import db from '../config/db.js';
import { REPUTATION_WEIGHT_SQL } from './reputation.js';

// An idea needs this many (non-held) ratings before it can appear in any Top list.
export const MIN_RATINGS_TO_RANK = 5;

// How many "average" votes every idea starts with (IMDb-style Bayesian average). Pulls ideas with few
// votes toward the site average, so 2 votes of 5.0 cannot beat 40 votes of 4.6.
export const PRIOR_VOTES = 5;

// Votes from accounts younger than 24 hours, or with no profile (no bio and no role), count half.
export const LOW_WEIGHT = 0.5;

// Ratings and demand votes in a burst are held for admin review: when a brand-new account votes on an idea
// that already got this many votes from brand-new accounts in the last BURST_WINDOW_MINUTES.
export const BURST_THRESHOLD = Number(process.env.VOTE_BURST_THRESHOLD || 5);
export const BURST_WINDOW_MINUTES = 10;

// SQL weight for a rating `r` by user `u`.
// Higher reputation levels' votes carry more weight (Trusted 1.25x, Top 1.5x).
export const RATING_WEIGHT_SQL = `
  (CASE
    WHEN r.created_at < datetime(u.created_at, '+1 day') THEN ${LOW_WEIGHT}
    WHEN COALESCE(TRIM(u.bio), '') = '' AND u.role_tag IS NULL THEN ${LOW_WEIGHT}
    ELSE 1.0
  END * ${REPUTATION_WEIGHT_SQL})`;

// Site-wide average of counted ratings (3.0 when there are none yet).
export const SITE_MEAN_SQL = '(SELECT COALESCE(AVG(CAST(score AS REAL)), 3.0) FROM ratings WHERE held = 0)';

// Per-idea weighted rating totals, optionally limited to ratings inside a time window.
// Join as: LEFT JOIN (${weightedRatingsSql(filter)}) ws ON ws.idea_id = i.id
export function weightedRatingsSql(ratingFilter = '') {
  return `
    SELECT
      r.idea_id,
      COUNT(*) AS n,
      SUM(${RATING_WEIGHT_SQL}) AS wsum,
      SUM(${RATING_WEIGHT_SQL} * r.score) AS wscore
    FROM ratings r
    JOIN users u ON u.id = r.user_id
    WHERE r.held = 0 ${ratingFilter}
    GROUP BY r.idea_id`;
}

// Bayesian score expression, given the `ws` alias from weightedRatingsSql.
export const RANKING_SCORE_SQL = `
  ROUND((COALESCE(ws.wscore, 0) + ${PRIOR_VOTES} * ${SITE_MEAN_SQL}) / (COALESCE(ws.wsum, 0) + ${PRIOR_VOTES}), 3)`;

// Per-idea counted demand totals (held votes excluded). Join as: LEFT JOIN (${DEMAND_TOTALS_SQL}) dm ON dm.idea_id = i.id
export const DEMAND_TOTALS_SQL = `
  SELECT
    idea_id,
    COUNT(*) AS demand_votes,
    SUM(CASE WHEN intent = 'would_pay' THEN 1 ELSE 0 END) AS would_pay_votes
  FROM demand_signals
  WHERE held = 0
  GROUP BY idea_id`;

// Should a new vote by `voter` on `ideaId` be held? `table` is 'ratings' or 'demand_signals'.
export async function isVoteBurst(table, ideaId, voterId) {
  if (!['ratings', 'demand_signals'].includes(table)) throw new Error('Unknown vote table');

  const voter = await db.prepare(`
    SELECT (created_at >= datetime('now', '-1 day')) AS is_new FROM users WHERE id = ?
  `).get(voterId);
  if (!voter || !Number(voter.is_new)) return false;

  const row = await db.prepare(`
    SELECT COUNT(*) AS recent
    FROM ${table} v
    JOIN users u ON u.id = v.user_id
    WHERE v.idea_id = ?
      AND v.user_id != ?
      AND v.created_at >= datetime('now', '-${BURST_WINDOW_MINUTES} minutes')
      AND u.created_at >= datetime('now', '-1 day')
  `).get(ideaId, voterId);

  return Number(row?.recent || 0) >= BURST_THRESHOLD;
}

export function rankingStats(row) {
  const counted = Number(row.ws_n || 0);
  const demandVotes = Number(row.demand_votes || 0);
  const wouldPay = Number(row.would_pay_votes || 0);
  return {
    ranking_score: Number(row.ranking_score || 0),
    needs_votes: counted < MIN_RATINGS_TO_RANK,
    votes_to_rank: Math.max(0, MIN_RATINGS_TO_RANK - counted),
    demand_votes: demandVotes,
    would_pay_pct: demandVotes > 0 ? Math.round((wouldPay / demandVotes) * 100) : 0
  };
}

export const TEAM_NAME = 'BusinessListe Team';

// Seed content is shown as posted by the team, never under an invented person's name.
export function displayAuthor(row, { withBio = false } = {}) {
  if (Number(row.is_team_seed)) {
    return { id: row.author_id, name: TEAM_NAME, avatar_url: null, is_team: true, ...(withBio ? { bio: 'Seed idea added by the BusinessListe team to get the community started.' } : {}) };
  }
  return {
    id: row.author_id,
    name: row.author_name,
    avatar_url: row.author_avatar,
    is_team: false,
    ...(withBio ? { bio: row.author_bio } : {})
  };
}
