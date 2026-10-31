import crypto from 'crypto';
import db from '../config/db.js';
import { NOTIFICATION_TYPES, resolvePrefs, notify } from '../services/notify.js';
import { levelFor, getBadges, BADGES } from '../services/reputation.js';
import { spamCheck } from '../services/spam.js';
import { displayAuthor } from '../services/ranking.js';

const AUTO_HIDE_REPORTS = 3;

// ---------- Notifications ----------
export async function listNotifications(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT id, type, title, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50
    `).all(req.user.id);
    const unread = await db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id);
    res.json({ success: true, data: { notifications: rows, unread: Number(unread?.n || 0) } });
  } catch (err) { next(err); }
}

export async function markNotificationsRead(req, res, next) {
  try {
    await db.prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL').run(req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getNotificationPrefs(req, res, next) {
  try {
    const row = await db.prepare('SELECT notify_prefs FROM users WHERE id = ?').get(req.user.id);
    res.json({
      success: true,
      data: {
        prefs: resolvePrefs(row?.notify_prefs),
        types: Object.fromEntries(Object.entries(NOTIFICATION_TYPES).map(([k, v]) => [k, v.label]))
      }
    });
  } catch (err) { next(err); }
}

export async function updateNotificationPrefs(req, res, next) {
  try {
    const row = await db.prepare('SELECT notify_prefs FROM users WHERE id = ?').get(req.user.id);
    const current = resolvePrefs(row?.notify_prefs);
    for (const [type, value] of Object.entries(req.body)) {
      if (!NOTIFICATION_TYPES[type]) continue;
      current[type] = { ...current[type], ...value };
    }
    await db.prepare('UPDATE users SET notify_prefs = ? WHERE id = ?').run(JSON.stringify(current), req.user.id);
    res.json({ success: true, data: { prefs: current } });
  } catch (err) { next(err); }
}

// ---------- Reputation ----------
export async function topContributors(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT u.id, u.name, u.avatar_url, u.role_tag, u.reputation, SUM(e.points) AS month_points,
             SUM(CASE WHEN e.kind = 'rating' THEN 1 ELSE 0 END) AS ratings,
             SUM(CASE WHEN e.kind = 'helpful' THEN 1 ELSE 0 END) AS helpful
      FROM reputation_events e JOIN users u ON u.id = e.user_id
      WHERE e.created_at >= datetime('now', '-30 days')
      GROUP BY u.id
      ORDER BY month_points DESC, u.reputation DESC
      LIMIT 50
    `).all();
    res.json({
      success: true,
      data: {
        contributors: rows.map((r, i) => ({
          rank: i + 1,
          id: r.id,
          name: r.name,
          avatar_url: r.avatar_url,
          role_tag: r.role_tag,
          month_points: Number(r.month_points),
          ratings: Number(r.ratings),
          helpful: Number(r.helpful),
          reputation: Number(r.reputation),
          level: levelFor(r.reputation)
        }))
      }
    });
  } catch (err) { next(err); }
}

export async function userReputation(req, res, next) {
  try {
    const user = await db.prepare('SELECT id, reputation FROM users WHERE id = ?').get(Number(req.params.id));
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found.' } });
    const verified = await db.prepare(`
      SELECT 1 FROM ideas WHERE user_id = ? AND mrr_verified_at IS NOT NULL AND COALESCE(mrr_verified_cents, 0) > 0 LIMIT 1
    `).get(user.id);
    res.json({
      success: true,
      data: {
        reputation: Number(user.reputation || 0),
        level: levelFor(user.reputation),
        badges: await getBadges(user.id),
        all_badges: BADGES,
        verified_revenue: Boolean(verified),
        linked: (await db.prepare(`
          SELECT provider, username FROM oauth_accounts WHERE user_id = ? AND provider IN ('x', 'linkedin')
        `).all(user.id)).map((a) => ({ provider: a.provider, username: a.username }))
      }
    });
  } catch (err) { next(err); }
}

// Profile tabs: repos shared and products launched.
export async function userRepos(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT id, full_name, description, stars, license, category, created_at FROM shared_repos
      WHERE user_id = ? AND hidden = 0 ORDER BY created_at DESC
    `).all(Number(req.params.id));
    res.json({ success: true, data: { repos: rows.map((r) => ({ ...r, stars: Number(r.stars), html_url: `https://github.com/${r.full_name}` })) } });
  } catch (err) { next(err); }
}

export async function userLaunches(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT id, title, pitch, launched_url, launched_at, mrr_range, (mrr_verified_at IS NOT NULL) AS verified
      FROM ideas WHERE user_id = ? AND status = 'published' AND launched_url IS NOT NULL AND is_team_seed = 0
      ORDER BY launched_at DESC
    `).all(Number(req.params.id));
    res.json({ success: true, data: { launches: rows.map((r) => ({ ...r, verified: Boolean(Number(r.verified)) })) } });
  } catch (err) { next(err); }
}

// ---------- Co-founder board ----------
export async function listCofounders(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT c.id, c.skills, c.looking_for, c.contact, c.updated_at, u.id AS user_id, u.name, u.avatar_url, u.role_tag, u.country
      FROM cofounder_posts c JOIN users u ON u.id = c.user_id
      ORDER BY c.updated_at DESC LIMIT 100
    `).all();
    // Contact details only for signed-in members, to keep them away from scrapers.
    res.json({ success: true, data: { posts: rows.map((r) => ({ ...r, contact: req.user ? r.contact : null })) } });
  } catch (err) { next(err); }
}

export async function upsertCofounder(req, res, next) {
  try {
    const { skills, looking_for, contact } = req.body;
    const spam = await spamCheck(req.user.id, `${skills} ${looking_for}`, { table: 'cofounder_posts', column: "skills || ' ' || looking_for" });
    if (spam && !spam.startsWith('You already')) return res.status(400).json({ success: false, error: { message: spam } });
    await db.prepare(`
      INSERT INTO cofounder_posts (user_id, skills, looking_for, contact) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET skills = excluded.skills, looking_for = excluded.looking_for,
        contact = excluded.contact, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, skills, looking_for, contact || null);
    res.json({ success: true, message: 'Your post is live on the co-founder board.' });
  } catch (err) { next(err); }
}

export async function deleteCofounder(req, res, next) {
  try {
    const target = req.user.role === 'admin' && req.query.user_id ? Number(req.query.user_id) : req.user.id;
    await db.prepare('DELETE FROM cofounder_posts WHERE user_id = ?').run(target);
    res.json({ success: true, message: 'Post removed.' });
  } catch (err) { next(err); }
}

// ---------- Search across ideas, repos and users ----------
export async function search(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q.length < 2) return res.json({ success: true, data: { ideas: [], repos: [], users: [] } });
    const term = `%${q}%`;
    const ideas = await db.prepare(`
      SELECT i.id, i.title, i.pitch, i.category, i.is_team_seed, u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar
      FROM ideas i JOIN users u ON u.id = i.user_id
      WHERE i.status = 'published' AND (i.title LIKE ? OR i.pitch LIKE ? OR i.description LIKE ? OR i.problem LIKE ?)
      ORDER BY i.created_at DESC LIMIT 20
    `).all(term, term, term, term);
    const repos = await db.prepare(`
      SELECT id, full_name, description, stars, category FROM shared_repos
      WHERE hidden = 0 AND (full_name LIKE ? OR description LIKE ? OR topics LIKE ? OR category LIKE ?)
      ORDER BY stars DESC LIMIT 10
    `).all(term, term, term, term);
    const users = await db.prepare(`
      SELECT id, name, avatar_url, role_tag, bio FROM users
      WHERE email NOT LIKE '%@businessliste.com' AND (name LIKE ? OR bio LIKE ?)
      ORDER BY reputation DESC LIMIT 10
    `).all(term, term);
    res.json({
      success: true,
      data: {
        ideas: ideas.map((r) => ({ id: r.id, title: r.title, pitch: r.pitch, category: r.category, author: displayAuthor(r) })),
        repos: repos.map((r) => ({ ...r, stars: Number(r.stars) })),
        users
      }
    });
  } catch (err) { next(err); }
}

// ---------- Discussions ----------
// Trending: ideas with comments, most recent activity first.
export async function trendingDiscussions(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT i.id, i.title, i.pitch, i.category, COUNT(c.id) AS comments, MAX(c.created_at) AS last_activity
      FROM comments c JOIN ideas i ON i.id = c.idea_id
      WHERE c.hidden = 0 AND i.status = 'published'
      GROUP BY i.id
      ORDER BY last_activity DESC
      LIMIT 30
    `).all();
    res.json({ success: true, data: { discussions: rows.map((r) => ({ ...r, comments: Number(r.comments) })) } });
  } catch (err) { next(err); }
}

export async function toggleCommentUpvote(req, res, next) {
  try {
    const comment = await db.prepare('SELECT id FROM comments WHERE id = ? AND hidden = 0').get(Number(req.params.commentId));
    if (!comment) return res.status(404).json({ success: false, error: { message: 'Comment not found.' } });
    if (req.method === 'DELETE') {
      await db.prepare('DELETE FROM comment_upvotes WHERE comment_id = ? AND user_id = ?').run(comment.id, req.user.id);
    } else {
      await db.prepare('INSERT OR IGNORE INTO comment_upvotes (comment_id, user_id) VALUES (?, ?)').run(comment.id, req.user.id);
    }
    const row = await db.prepare('SELECT COUNT(*) AS n FROM comment_upvotes WHERE comment_id = ?').get(comment.id);
    res.json({ success: true, data: { upvotes: Number(row.n), has_upvoted: req.method !== 'DELETE' } });
  } catch (err) { next(err); }
}

export async function listRepoComments(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT c.id, c.parent_id, c.content, c.created_at, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar
      FROM repo_comments c JOIN users u ON u.id = c.user_id
      WHERE c.repo_id = ? AND c.hidden = 0 ORDER BY c.created_at ASC
    `).all(Number(req.params.id));
    res.json({
      success: true,
      data: { comments: rows.map((c) => ({ id: c.id, parent_id: c.parent_id, content: c.content, created_at: c.created_at, user: { id: c.user_id, name: c.user_name, avatar_url: c.user_avatar } })) }
    });
  } catch (err) { next(err); }
}

export async function createRepoComment(req, res, next) {
  try {
    const repo = await db.prepare('SELECT id, user_id, full_name FROM shared_repos WHERE id = ? AND hidden = 0').get(Number(req.params.id));
    if (!repo) return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
    const { content, parent_id } = req.body;
    if (parent_id) {
      const parent = await db.prepare('SELECT id FROM repo_comments WHERE id = ? AND repo_id = ?').get(parent_id, repo.id);
      if (!parent) return res.status(400).json({ success: false, error: { message: 'Parent comment not found for this repo.' } });
    }
    const spam = await spamCheck(req.user.id, content, { table: 'repo_comments', column: 'content' });
    if (spam) return res.status(400).json({ success: false, error: { message: spam } });
    const result = await db.prepare('INSERT INTO repo_comments (repo_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)')
      .run(repo.id, req.user.id, parent_id || null, content);
    if (Number(repo.user_id) !== Number(req.user.id)) {
      await notify(repo.user_id, 'comment', `${req.user.name} commented on ${repo.full_name}`, `/repos?search=${encodeURIComponent(repo.full_name)}`);
    }
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) { next(err); }
}

export async function deleteRepoComment(req, res, next) {
  try {
    const c = await db.prepare('SELECT id, user_id FROM repo_comments WHERE id = ?').get(Number(req.params.commentId));
    if (!c) return res.status(404).json({ success: false, error: { message: 'Comment not found.' } });
    if (Number(c.user_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'You can only delete your own comments.' } });
    }
    await db.prepare('DELETE FROM repo_comments WHERE id = ?').run(c.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ---------- Reports on comments and repos (auto-hide after 3) ----------
const TARGETS = {
  comment: { table: 'comments', hide: 'UPDATE comments SET hidden = 1 WHERE id = ?' },
  repo: { table: 'shared_repos', hide: 'UPDATE shared_repos SET hidden = 1 WHERE id = ?' },
  repo_comment: { table: 'repo_comments', hide: 'UPDATE repo_comments SET hidden = 1 WHERE id = ?' }
};

export async function createContentReport(req, res, next) {
  try {
    const { target_type, target_id, reason } = req.body;
    const target = TARGETS[target_type];
    const exists = await db.prepare(`SELECT id FROM ${target.table} WHERE id = ?`).get(target_id);
    if (!exists) return res.status(404).json({ success: false, error: { message: 'Content not found.' } });
    try {
      await db.prepare('INSERT INTO content_reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)')
        .run(req.user.id, target_type, target_id, reason);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: { message: 'You already reported this.' } });
      }
      throw err;
    }
    const count = await db.prepare(`
      SELECT COUNT(*) AS n FROM content_reports WHERE target_type = ? AND target_id = ? AND status = 'pending'
    `).get(target_type, target_id);
    if (Number(count.n) >= AUTO_HIDE_REPORTS) await db.prepare(target.hide).run(target_id);
    res.status(201).json({ success: true, message: 'Thanks. A moderator will review it.' });
  } catch (err) { next(err); }
}

// ---------- Weekly email unsubscribe ----------
export async function unsubscribe(req, res, next) {
  try {
    const token = String(req.query.token || '');
    if (!/^[a-f0-9]{32,64}$/.test(token)) return res.status(400).json({ success: false, error: { message: 'Invalid link.' } });
    const result = await db.prepare('UPDATE waitlist_signups SET unsubscribed_at = CURRENT_TIMESTAMP WHERE unsubscribe_token = ?').run(token);
    if (!result.rowsAffected) return res.status(404).json({ success: false, error: { message: 'Link not found.' } });
    res.json({ success: true, message: 'You are unsubscribed from the weekly email.' });
  } catch (err) { next(err); }
}

export function newUnsubscribeToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Remove a linked X or LinkedIn account (Google/GitHub stay: they may be the only way to sign in).
export async function unlinkAccount(req, res, next) {
  try {
    if (!['x', 'linkedin'].includes(req.params.provider)) {
      return res.status(400).json({ success: false, error: { message: 'Only X and LinkedIn can be unlinked here.' } });
    }
    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const others = await db.prepare('SELECT COUNT(*) AS n FROM oauth_accounts WHERE user_id = ? AND provider != ?').get(req.user.id, req.params.provider);
    if (user.password_hash === '!oauth' && Number(others.n) === 0) {
      return res.status(400).json({ success: false, error: { message: 'This is your only way to sign in, so it cannot be removed.' } });
    }
    await db.prepare('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?').run(req.user.id, req.params.provider);
    res.json({ success: true });
  } catch (err) { next(err); }
}
