import db from '../config/db.js';
import { award } from '../services/reputation.js';
import { notify } from '../services/notify.js';
import { fetchStripeMrrCents } from '../services/payments.js';
import { getDemandSummary } from './demand.controller.js';
import { displayAuthor } from '../services/ranking.js';

const STOPWORDS = new Set(('that this with from your their them they have will would into about what when where which while there these those than then them ' +
  'for and the are you our can not but all any one out use using used more most such just also only very much many make makes made app apps tool tools ' +
  'platform simple easy helps help users user people every each other based like build built small team teams').split(/\s+/));

export function keywords(text) {
  return [...new Set(String(text || '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [])].filter((w) => !STOPWORDS.has(w));
}

function overlapScore(a, b) {
  const set = new Set(b);
  return a.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
}

async function loadIdea(id) {
  return db.prepare('SELECT * FROM ideas WHERE id = ?').get(Number(id));
}

function isOwnerOrAdmin(req, idea) {
  return req.user && (Number(req.user.id) === Number(idea.user_id) || req.user.role === 'admin');
}

async function isPro(userId) {
  const row = await db.prepare("SELECT (pro_until IS NOT NULL AND pro_until > datetime('now')) AS pro FROM users WHERE id = ?").get(userId);
  return Boolean(Number(row?.pro));
}

const notFound = (res) => res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
const forbidden = (res, message = 'Only the founder can do this.') => res.status(403).json({ success: false, error: { message } });

// Duplicate check while typing a title: published ideas sharing the most words.
export async function similarTitles(req, res, next) {
  try {
    const words = keywords(req.query.q).slice(0, 8);
    if (words.length === 0) return res.json({ success: true, data: { ideas: [] } });
    const rows = await db.prepare(`
      SELECT id, title, pitch FROM ideas
      WHERE status = 'published' AND (${words.map(() => '(LOWER(title) LIKE ? OR LOWER(pitch) LIKE ?)').join(' OR ')})
      LIMIT 50
    `).all(...words.flatMap((w) => [`%${w}%`, `%${w}%`]));
    const ideas = rows
      .map((r) => ({ ...r, score: overlapScore(words, keywords(`${r.title} ${r.pitch}`)) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ id, title, pitch }) => ({ id, title, pitch }));
    res.json({ success: true, data: { ideas } });
  } catch (err) { next(err); }
}

// Similar ideas on BusinessListe: same category first, then shared words.
export async function similarIdeas(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    const words = keywords(`${idea.title} ${idea.pitch} ${idea.problem || ''}`);
    const rows = await db.prepare(`
      SELECT id, title, pitch, category FROM ideas
      WHERE status = 'published' AND id != ?
      ORDER BY created_at DESC LIMIT 300
    `).all(idea.id);
    const ideas = rows
      .map((r) => ({ ...r, score: overlapScore(words, keywords(`${r.title} ${r.pitch}`)) * 2 + (r.category === idea.category ? 1 : 0) }))
      .filter((r) => r.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ id, title, pitch, category }) => ({ id, title, pitch, category }));
    res.json({ success: true, data: { ideas } });
  } catch (err) { next(err); }
}

// "Similar open-source projects" on an idea page.
export async function relatedRepos(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    const words = keywords(`${idea.title} ${idea.pitch} ${idea.problem || ''} ${idea.description}`);
    const repos = await db.prepare(`
      SELECT id, full_name, description, stars, license, category, topics FROM shared_repos WHERE hidden = 0 LIMIT 1000
    `).all();
    const matches = repos
      .map((r) => ({ ...r, score: overlapScore(words, keywords(`${r.full_name.replace(/[/_.-]/g, ' ')} ${r.description || ''} ${r.category || ''} ${(JSON.parse(r.topics || '[]')).join(' ')}`)) }))
      .filter((r) => r.score >= 2)
      .sort((a, b) => b.score - a.score || b.stars - a.stars)
      .slice(0, 4)
      .map(({ id, full_name, description, stars, license, category }) => ({
        id, full_name, description, stars: Number(stars), license, category, html_url: `https://github.com/${full_name}`
      }));
    res.json({ success: true, data: { repos: matches } });
  } catch (err) { next(err); }
}

// Ideas on BusinessListe that a repo could power.
export async function ideasForRepo(req, res, next) {
  try {
    const repo = await db.prepare('SELECT * FROM shared_repos WHERE id = ? AND hidden = 0').get(Number(req.params.id));
    if (!repo) return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
    const words = keywords(`${repo.full_name.replace(/[/_.-]/g, ' ')} ${repo.description || ''} ${repo.category || ''} ${(JSON.parse(repo.topics || '[]')).join(' ')}`);
    const ideas = await db.prepare(`SELECT id, title, pitch, category, description, problem FROM ideas WHERE status = 'published' ORDER BY created_at DESC LIMIT 500`).all();
    const matches = ideas
      .map((i) => ({ ...i, score: overlapScore(words, keywords(`${i.title} ${i.pitch} ${i.problem || ''} ${i.description}`)) }))
      .filter((i) => i.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ id, title, pitch, category }) => ({ id, title, pitch, category }));
    res.json({ success: true, data: { ideas: matches } });
  } catch (err) { next(err); }
}

export async function getRevisions(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea || (idea.status !== 'published' && !isOwnerOrAdmin(req, idea))) return notFound(res);
    const revisions = await db.prepare(`
      SELECT id, title, pitch, description, created_at AS replaced_at FROM idea_revisions WHERE idea_id = ? ORDER BY id DESC
    `).all(idea.id);
    res.json({ success: true, data: { revisions } });
  } catch (err) { next(err); }
}

export async function myDrafts(req, res, next) {
  try {
    const drafts = await db.prepare(`
      SELECT id, title, pitch, category, created_at, updated_at FROM ideas WHERE user_id = ? AND status = 'draft' ORDER BY updated_at DESC
    `).all(req.user.id);
    res.json({ success: true, data: { ideas: drafts } });
  } catch (err) { next(err); }
}

// Counts a page view by referrer host (no personal data stored).
export async function trackView(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea || idea.status !== 'published') return res.json({ success: true });
    let referrer = 'direct';
    try {
      const host = new URL(String(req.body?.referrer || '')).hostname.replace(/^www\./, '');
      const own = new URL(String(req.headers.origin || 'http://x')).hostname.replace(/^www\./, '');
      if (host && host !== own) referrer = host.slice(0, 100);
    } catch { /* no or invalid referrer */ }
    await db.prepare(`
      INSERT INTO idea_views (idea_id, day, referrer, views) VALUES (?, date('now'), ?, 1)
      ON CONFLICT(idea_id, day, referrer) DO UPDATE SET views = views + 1
    `).run(idea.id, referrer);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// Pro analytics: views per day, where voters came from, vote trend.
export async function getAnalytics(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    if (!isOwnerOrAdmin(req, idea)) return forbidden(res);
    if (req.user.role !== 'admin' && !(await isPro(req.user.id))) {
      return res.status(402).json({ success: false, error: { message: 'Analytics are part of BusinessListe Pro.', code: 'PRO_REQUIRED' } });
    }
    const views = await db.prepare(`
      SELECT day, SUM(views) AS views FROM idea_views WHERE idea_id = ? AND day >= date('now', '-30 days') GROUP BY day ORDER BY day
    `).all(idea.id);
    const referrers = await db.prepare(`
      SELECT referrer, SUM(views) AS views FROM idea_views WHERE idea_id = ? GROUP BY referrer ORDER BY views DESC LIMIT 10
    `).all(idea.id);
    const votes = await db.prepare(`
      SELECT date(created_at) AS day, COUNT(*) AS votes, SUM(CASE WHEN intent = 'would_pay' THEN 1 ELSE 0 END) AS would_pay
      FROM demand_signals WHERE idea_id = ? AND held = 0 AND created_at >= datetime('now', '-30 days')
      GROUP BY date(created_at) ORDER BY day
    `).all(idea.id);
    res.json({
      success: true,
      data: {
        views: views.map((v) => ({ day: v.day, views: Number(v.views) })),
        referrers: referrers.map((r) => ({ referrer: r.referrer, views: Number(r.views) })),
        votes: votes.map((v) => ({ day: v.day, votes: Number(v.votes), would_pay: Number(v.would_pay) }))
      }
    });
  } catch (err) { next(err); }
}

// "I want to build this"
export async function getBuilders(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea || idea.status !== 'published') return notFound(res);
    const countRow = await db.prepare('SELECT COUNT(*) AS n FROM build_interest WHERE idea_id = ?').get(idea.id);
    const mine = req.user ? await db.prepare('SELECT note FROM build_interest WHERE idea_id = ? AND user_id = ?').get(idea.id, req.user.id) : null;
    let builders = null;
    if (isOwnerOrAdmin(req, idea)) {
      builders = await db.prepare(`
        SELECT u.id, u.name, u.avatar_url, u.role_tag, b.note, b.created_at
        FROM build_interest b JOIN users u ON u.id = b.user_id WHERE b.idea_id = ? ORDER BY b.created_at DESC
      `).all(idea.id);
    }
    res.json({ success: true, data: { count: Number(countRow?.n || 0), interested: Boolean(mine), builders } });
  } catch (err) { next(err); }
}

export async function setBuildInterest(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea || idea.status !== 'published') return notFound(res);
    if (Number(idea.user_id) === Number(req.user.id)) {
      return res.status(400).json({ success: false, error: { message: 'This is your own idea.' } });
    }
    const result = await db.prepare(`
      INSERT INTO build_interest (idea_id, user_id, note) VALUES (?, ?, ?)
      ON CONFLICT(idea_id, user_id) DO UPDATE SET note = excluded.note
    `).run(idea.id, req.user.id, req.body.note || null);
    if (result.rowsAffected) {
      await notify(idea.user_id, 'build_interest', `${req.user.name} wants to build "${idea.title}"`, `/ideas/${idea.id}`);
    }
    return getBuilders(req, res, next);
  } catch (err) { next(err); }
}

export async function removeBuildInterest(req, res, next) {
  try {
    await db.prepare('DELETE FROM build_interest WHERE idea_id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    return getBuilders(req, res, next);
  } catch (err) { next(err); }
}

// Founder marks structured feedback helpful: +5 reputation to the rater.
export async function markFeedbackHelpful(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    if (Number(idea.user_id) !== Number(req.user.id)) return forbidden(res);
    const raterId = Number(req.params.userId);
    const fb = await db.prepare('SELECT id FROM idea_feedback WHERE idea_id = ? AND user_id = ?').get(idea.id, raterId);
    if (!fb) return res.status(404).json({ success: false, error: { message: 'Feedback not found.' } });
    await db.prepare('UPDATE idea_feedback SET helpful = 1 WHERE id = ?').run(fb.id);
    await award(raterId, 'helpful', fb.id);
    res.json({ success: true, message: 'Marked as helpful.' });
  } catch (err) { next(err); }
}

// 7 Launch tracking
export async function markLaunched(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    if (!isOwnerOrAdmin(req, idea)) return forbidden(res);
    const { launched_url, launched_at, mrr_range, show_exact_mrr } = req.body;
    await db.prepare(`
      UPDATE ideas SET launched_url = ?, launched_at = ?, mrr_range = ?, show_exact_mrr = ? WHERE id = ?
    `).run(launched_url, launched_at, mrr_range || null, show_exact_mrr ? 1 : 0, idea.id);
    res.json({ success: true, message: 'Marked as launched.' });
  } catch (err) { next(err); }
}

export async function removeLaunch(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    if (!isOwnerOrAdmin(req, idea)) return forbidden(res);
    await db.prepare(`
      UPDATE ideas SET launched_url = NULL, launched_at = NULL, mrr_range = NULL, mrr_verified_cents = NULL, mrr_verified_at = NULL WHERE id = ?
    `).run(idea.id);
    res.json({ success: true, message: 'Launch removed.' });
  } catch (err) { next(err); }
}

export function mrrRangeFor(cents) {
  const d = cents / 100;
  if (d <= 0) return 'pre_revenue';
  if (d < 1000) return 'under_1k';
  if (d < 5000) return '1k_5k';
  if (d < 20000) return '5k_20k';
  if (d < 100000) return '20k_100k';
  return 'over_100k';
}

// Reads MRR once with a Stripe restricted key, stores only the number. Raters who said "I'd pay"
// earn Spotted a Winner (+10) once verified revenue is above zero.
export async function verifyRevenue(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    if (Number(idea.user_id) !== Number(req.user.id)) return forbidden(res);
    if (!idea.launched_url) {
      return res.status(400).json({ success: false, error: { message: 'Mark the idea as launched first.' } });
    }
    let cents;
    try {
      cents = await fetchStripeMrrCents(req.body.stripe_key);
    } catch (err) {
      return res.status(400).json({ success: false, error: { message: `Could not read revenue from Stripe: ${err.message}` } });
    }
    await db.prepare(`
      UPDATE ideas SET mrr_verified_cents = ?, mrr_verified_at = CURRENT_TIMESTAMP, mrr_range = ? WHERE id = ?
    `).run(cents, mrrRangeFor(cents), idea.id);

    if (cents > 0) {
      const voters = await db.prepare(`SELECT user_id FROM demand_signals WHERE idea_id = ? AND intent = 'would_pay' AND held = 0`).all(idea.id);
      for (const v of voters) await award(v.user_id, 'winner', idea.id);
    }
    res.json({ success: true, data: { mrr_range: mrrRangeFor(cents), verified: true }, message: 'Revenue verified. Your key was not stored.' });
  } catch (err) { next(err); }
}

// "Launched from BusinessListe": every launched idea, its original demand and today's revenue.
export async function listLaunches(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT i.id, i.title, i.pitch, i.category, i.created_at, i.launched_url, i.launched_at, i.mrr_range,
             i.mrr_verified_cents, i.mrr_verified_at, i.show_exact_mrr, i.is_team_seed,
             u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar
      FROM ideas i JOIN users u ON u.id = i.user_id
      WHERE i.status = 'published' AND i.launched_url IS NOT NULL
      ORDER BY (i.mrr_verified_at IS NOT NULL) DESC, COALESCE(i.mrr_verified_cents, 0) DESC, i.launched_at DESC
    `).all();
    const launches = [];
    for (const r of rows) {
      launches.push({
        id: r.id,
        title: r.title,
        pitch: r.pitch,
        category: r.category,
        posted_at: r.created_at,
        author: displayAuthor(r),
        launch: {
          url: r.launched_url,
          launched_at: r.launched_at,
          mrr_range: r.mrr_range,
          mrr_verified_cents: r.show_exact_mrr && r.mrr_verified_cents != null ? Number(r.mrr_verified_cents) : null,
          verified: r.mrr_verified_at != null
        },
        demand: await getDemandSummary(r.id)
      });
    }
    res.json({ success: true, data: { launches } });
  } catch (err) { next(err); }
}

// Pro: fake-door landing page per idea, with an email waitlist.
export async function getLanding(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea || idea.status !== 'published') return notFound(res);
    if (!(await isPro(idea.user_id))) {
      return res.status(404).json({ success: false, error: { message: 'This idea has no landing page.' } });
    }
    const count = await db.prepare('SELECT COUNT(*) AS n FROM landing_signups WHERE idea_id = ?').get(idea.id);
    res.json({
      success: true,
      data: {
        idea: {
          id: idea.id, title: idea.title, pitch: idea.pitch, problem: idea.problem, how_it_works: idea.how_it_works,
          target_buyer: idea.target_buyer, suggested_price: idea.suggested_price
        },
        signups: Number(count?.n || 0)
      }
    });
  } catch (err) { next(err); }
}

export async function landingSignup(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea || idea.status !== 'published' || !(await isPro(idea.user_id))) return notFound(res);
    await db.prepare('INSERT OR IGNORE INTO landing_signups (idea_id, email) VALUES (?, ?)').run(idea.id, req.body.email);
    res.json({ success: true, message: "You're on the list. The founder will email you at launch." });
  } catch (err) { next(err); }
}

export async function landingSignups(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea) return notFound(res);
    if (!isOwnerOrAdmin(req, idea)) return forbidden(res);
    const rows = await db.prepare('SELECT email, created_at FROM landing_signups WHERE idea_id = ? ORDER BY created_at DESC').all(idea.id);
    res.json({ success: true, data: { signups: rows } });
  } catch (err) { next(err); }
}

// Pro targeted raters: who should see this idea first. Matching raters get one notification per idea.
export async function setTargeting(req, res, next) {
  try {
    const idea = await loadIdea(req.params.id);
    if (!idea || idea.status !== 'published') return notFound(res);
    if (!isOwnerOrAdmin(req, idea)) return forbidden(res);
    if (req.user.role !== 'admin' && !(await isPro(req.user.id))) {
      return res.status(402).json({ success: false, error: { message: 'Targeted raters are part of BusinessListe Pro.', code: 'PRO_REQUIRED' } });
    }
    const roles = [...new Set(req.body.target_roles || [])];
    const industry = req.body.target_industry || null;
    await db.prepare('UPDATE ideas SET target_roles = ?, target_industry = ? WHERE id = ?')
      .run(roles.length ? roles.join(',') : null, industry, idea.id);
    const notified = await notifyTargetedRaters(idea.id);
    res.json({ success: true, data: { target_roles: roles, target_industry: industry, notified } });
  } catch (err) { next(err); }
}

export async function notifyTargetedRaters(ideaId, limit = 50) {
  const idea = await loadIdea(ideaId);
  if (!idea || (!idea.target_roles && !idea.target_industry)) return 0;
  const roles = String(idea.target_roles || '').split(',').filter(Boolean);
  const conds = [];
  const params = [];
  if (roles.length) { conds.push(`u.role_tag IN (${roles.map(() => '?').join(',')})`); params.push(...roles); }
  if (idea.target_industry) { conds.push('LOWER(u.industry) = LOWER(?)'); params.push(idea.target_industry); }
  const link = `/ideas/${idea.id}`;
  const raters = await db.prepare(`
    SELECT u.id FROM users u
    WHERE (${conds.join(' OR ')})
      AND u.id != ?
      AND NOT EXISTS (SELECT 1 FROM demand_signals d WHERE d.idea_id = ? AND d.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.type = 'targeted' AND n.link = ?)
    ORDER BY u.reputation DESC
    LIMIT ?
  `).all(...params, idea.user_id, idea.id, link, limit);
  for (const r of raters) {
    await notify(r.id, 'targeted', `An idea for people like you needs your vote: "${idea.title}"`, link);
  }
  return raters.length;
}
