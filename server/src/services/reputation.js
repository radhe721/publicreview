import db from '../config/db.js';

export const POINTS = { rating: 1, helpful: 5, winner: 10 };

export const LEVELS = [
  { id: 'top_reviewer', label: 'Top Reviewer', min: 200, weight: 1.5 },
  { id: 'trusted_reviewer', label: 'Trusted Reviewer', min: 50, weight: 1.25 },
  { id: 'reviewer', label: 'Reviewer', min: 10, weight: 1.0 },
  { id: 'new', label: 'New', min: 0, weight: 1.0 }
];

export const BADGES = {
  first_rating: 'First Rating',
  hundred_ratings: '100 Ratings',
  early_supporter: 'Early Supporter',
  spotted_winner: 'Spotted a Winner'
};

// The first 500 accounts are Early Supporters.
const EARLY_SUPPORTER_MAX_ID = 500;

export function levelFor(points) {
  const p = Number(points || 0);
  const level = LEVELS.find((l) => p >= l.min);
  return { id: level.id, label: level.label };
}

// Extra ranking weight for experienced raters (applied on top of the new-account rule).
export const REPUTATION_WEIGHT_SQL = `
  CASE WHEN COALESCE(u.reputation, 0) >= 200 THEN 1.5
       WHEN COALESCE(u.reputation, 0) >= 50 THEN 1.25
       ELSE 1.0 END`;

async function grantBadge(userId, badge) {
  await db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge) VALUES (?, ?)').run(userId, badge);
}

// Awards points once per (user, kind, ref). Returns true when new points were given.
export async function award(userId, kind, refId) {
  const points = POINTS[kind];
  if (!points || !userId) return false;
  const result = await db.prepare(
    'INSERT OR IGNORE INTO reputation_events (user_id, kind, ref_id, points) VALUES (?, ?, ?, ?)'
  ).run(userId, kind, refId, points);
  if (!result.rowsAffected) return false;
  await db.prepare('UPDATE users SET reputation = reputation + ? WHERE id = ?').run(points, userId);
  if (kind === 'winner') await grantBadge(userId, 'spotted_winner');
  await checkRatingBadges(userId);
  return true;
}

export async function checkRatingBadges(userId) {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM ratings WHERE user_id = ? AND held = 0').get(userId);
  const n = Number(row?.n || 0);
  if (n >= 1) await grantBadge(userId, 'first_rating');
  if (n >= 100) await grantBadge(userId, 'hundred_ratings');
  if (Number(userId) <= EARLY_SUPPORTER_MAX_ID && n >= 1) await grantBadge(userId, 'early_supporter');
}

export async function getBadges(userId) {
  const rows = await db.prepare('SELECT badge, awarded_at FROM user_badges WHERE user_id = ? ORDER BY awarded_at').all(userId);
  return rows.map((r) => ({ id: r.badge, label: BADGES[r.badge] || r.badge, awarded_at: r.awarded_at }));
}
