import db from '../config/db.js';

// Votes held by burst detection, newest first, so an admin can release or delete them.
export async function getHeldVotes(req, res, next) {
  try {
    const ratings = await db.prepare(`
      SELECT 'rating' AS kind, r.id, r.idea_id, i.title AS idea_title, r.score AS value, r.created_at,
             u.id AS user_id, u.name AS user_name, u.email AS user_email, u.created_at AS user_created_at
      FROM ratings r JOIN users u ON u.id = r.user_id JOIN ideas i ON i.id = r.idea_id
      WHERE r.held = 1
      ORDER BY r.created_at DESC
      LIMIT 200
    `).all();
    const demand = await db.prepare(`
      SELECT 'demand' AS kind, d.id, d.idea_id, i.title AS idea_title, d.intent AS value, d.created_at,
             u.id AS user_id, u.name AS user_name, u.email AS user_email, u.created_at AS user_created_at
      FROM demand_signals d JOIN users u ON u.id = d.user_id JOIN ideas i ON i.id = d.idea_id
      WHERE d.held = 1
      ORDER BY d.created_at DESC
      LIMIT 200
    `).all();

    const votes = [...ratings, ...demand].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    res.json({ success: true, data: { votes } });
  } catch (err) {
    next(err);
  }
}

const TABLES = { rating: 'ratings', demand: 'demand_signals' };

// action: "release" counts the vote; "delete" removes it.
export async function reviewHeldVote(req, res, next) {
  try {
    const table = TABLES[req.params.kind];
    if (!table) {
      return res.status(400).json({ success: false, error: { message: 'Unknown vote type.' } });
    }
    const id = Number(req.params.id);
    const vote = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND held = 1`).get(id);
    if (!vote) {
      return res.status(404).json({ success: false, error: { message: 'Held vote not found.' } });
    }

    if (req.body.action === 'release') {
      await db.prepare(`UPDATE ${table} SET held = 0 WHERE id = ?`).run(id);
    } else {
      await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    }
    res.json({ success: true, message: req.body.action === 'release' ? 'Vote released.' : 'Vote deleted.' });
  } catch (err) {
    next(err);
  }
}
