import db from '../config/db.js';

const MAX_LINKS = 3;

// Returns an error message when text looks like spam, otherwise null.
// table/column: where the same user's recent posts live, to catch copy-paste flooding.
export async function spamCheck(userId, text, { table, column }) {
  const body = String(text || '');
  const links = body.match(/https?:\/\/|www\./gi) || [];
  if (links.length > MAX_LINKS) return `Please include at most ${MAX_LINKS} links.`;

  const normalized = body.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length >= 20) {
    const dup = await db.prepare(`
      SELECT 1 FROM ${table}
      WHERE user_id = ? AND LOWER(TRIM(${column})) = ? AND created_at >= datetime('now', '-1 day')
      LIMIT 1
    `).get(userId, normalized);
    if (dup) return 'You already posted this. Please do not post the same text twice.';
  }
  return null;
}
