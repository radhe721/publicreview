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

// Admin dashboard: newest ideas, repos, users, purchases and open content reports.
export async function getOverview(req, res, next) {
  try {
    const counts = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM ideas WHERE status = 'published') AS ideas,
        (SELECT COUNT(*) FROM ideas WHERE status = 'hidden') AS hidden_ideas,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM shared_repos) AS repos,
        (SELECT COUNT(DISTINCT user_id) FROM demand_signals WHERE created_at >= datetime('now', '-30 days')) AS active_raters,
        (SELECT COUNT(*) FROM demand_signals WHERE held = 0) AS demand_votes,
        (SELECT COUNT(*) FROM waitlist_signups WHERE unsubscribed_at IS NULL) AS subscribers,
        (SELECT COUNT(*) FROM purchases WHERE status = 'paid') AS paid_purchases,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM purchases WHERE status = 'paid') AS revenue_cents
    `).get();
    const ideas = await db.prepare(`
      SELECT i.id, i.title, i.category, i.status, i.is_team_seed, i.created_at, u.name AS author_name
      FROM ideas i JOIN users u ON u.id = i.user_id ORDER BY i.id DESC LIMIT 30
    `).all();
    const repos = await db.prepare(`
      SELECT r.id, r.full_name, r.hidden, r.created_at, u.name AS shared_by FROM shared_repos r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT 20
    `).all();
    const users = await db.prepare(`
      SELECT id, name, email, role, role_tag, reputation, created_at, (pro_until IS NOT NULL AND pro_until > datetime('now')) AS is_pro
      FROM users ORDER BY id DESC LIMIT 30
    `).all();
    const purchases = await db.prepare(`
      SELECT p.id, p.product, p.status, p.amount_cents, p.created_at, p.paid_at, p.idea_id, u.name AS user_name, u.email AS user_email
      FROM purchases p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 30
    `).all();
    const contentReports = await db.prepare(`
      SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at, u.name AS reporter
      FROM content_reports r JOIN users u ON u.id = r.reporter_id WHERE r.status = 'pending' ORDER BY r.id DESC LIMIT 50
    `).all();
    const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));
    res.json({ success: true, data: { counts: num(counts), ideas, repos, users, purchases, content_reports: contentReports } });
  } catch (err) {
    next(err);
  }
}

// Hide / restore an idea, or change its category.
export async function updateIdeaAdmin(req, res, next) {
  try {
    const id = Number(req.params.id);
    const idea = await db.prepare('SELECT id, status FROM ideas WHERE id = ?').get(id);
    if (!idea) return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    if (req.body.status) await db.prepare('UPDATE ideas SET status = ? WHERE id = ?').run(req.body.status, id);
    if (req.body.category) await db.prepare('UPDATE ideas SET category = ? WHERE id = ?').run(req.body.category, id);
    res.json({ success: true, message: 'Idea updated.' });
  } catch (err) {
    next(err);
  }
}

const HIDEABLE = { comment: 'comments', repo: 'shared_repos', repo_comment: 'repo_comments' };

export async function setHidden(req, res, next) {
  try {
    const table = HIDEABLE[req.params.type];
    if (!table) return res.status(400).json({ success: false, error: { message: 'Unknown content type.' } });
    const id = Number(req.params.id);
    const result = await db.prepare(`UPDATE ${table} SET hidden = ? WHERE id = ?`).run(req.body.hidden ? 1 : 0, id);
    if (!result.rowsAffected) return res.status(404).json({ success: false, error: { message: 'Content not found.' } });
    if (!req.body.hidden) {
      // Restoring means the reports were reviewed and dismissed.
      await db.prepare("UPDATE content_reports SET status = 'dismissed' WHERE target_type = ? AND target_id = ? AND status = 'pending'").run(req.params.type, id);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function resolveContentReport(req, res, next) {
  try {
    const status = req.body.status === 'dismissed' ? 'dismissed' : 'resolved';
    await db.prepare('UPDATE content_reports SET status = ? WHERE id = ?').run(status, Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
