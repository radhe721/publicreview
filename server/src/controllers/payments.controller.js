import crypto from 'crypto';
import db from '../config/db.js';
import { env } from '../config/env.js';
import { PRODUCTS, paymentsEnabled, createCheckoutSession, verifyStripeSignature } from '../services/payments.js';
import { getDemandSummary } from './demand.controller.js';
import { notify } from '../services/notify.js';
import { notifyTargetedRaters } from './ideaExtras.controller.js';

export const REPORT_DAYS = 7;
export const REPORT_TARGET_VOTES = 25;
export const FEATURED_SLOTS_PER_DAY = 3;
// "Validated on BusinessListe" badge: demand score of at least 50 from at least 10 votes.
export const BADGE_MIN_SCORE = 50;
export const BADGE_MIN_VOTES = 10;

export function getPaymentsConfig(req, res) {
  res.json({
    success: true,
    data: {
      enabled: paymentsEnabled(),
      products: Object.fromEntries(Object.entries(PRODUCTS).map(([k, p]) => [k, { name: p.name, amount_cents: p.amount }])),
      featured_slots_per_day: FEATURED_SLOTS_PER_DAY
    }
  });
}

async function featuredSlotsUsed() {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM ideas WHERE featured_until IS NOT NULL AND featured_until > datetime('now')").get();
  return Number(row?.n || 0);
}

async function ownIdea(req, ideaId) {
  const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(Number(ideaId));
  if (!idea || idea.status !== 'published') return { error: [404, 'Idea not found.'] };
  if (Number(idea.user_id) !== Number(req.user.id) && req.user.role !== 'admin') return { error: [403, 'Only the founder can buy this for an idea.'] };
  return { idea };
}

// Starts a report for an idea: 7 days of boosted visibility to raters.
export async function startReport(ideaId, purchaseId = null) {
  const running = await db.prepare("SELECT id FROM validation_reports WHERE idea_id = ? AND ends_at > datetime('now')").get(ideaId);
  if (running) return running.id;
  const token = crypto.randomBytes(16).toString('hex');
  const result = await db.prepare(`
    INSERT INTO validation_reports (idea_id, purchase_id, public_token, ends_at) VALUES (?, ?, ?, datetime('now', '+${REPORT_DAYS} days'))
  `).run(ideaId, purchaseId, token);
  await db.prepare(`UPDATE ideas SET boosted_until = datetime('now', '+${REPORT_DAYS} days') WHERE id = ?`).run(ideaId);
  const idea = await db.prepare('SELECT user_id, title FROM ideas WHERE id = ?').get(ideaId);
  await notify(idea.user_id, 'report', `Your Validation Report for "${idea.title}" has started`, `/ideas/${ideaId}/report`);
  await notifyTargetedRaters(ideaId);
  return result.lastInsertRowid;
}

// Applies a paid (or granted) purchase. Safe to call twice.
export async function fulfillPurchase(purchaseId, status = 'paid', providerRef = null) {
  const p = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
  if (!p || p.status === 'paid' || p.status === 'granted') return p;
  await db.prepare('UPDATE purchases SET status = ?, paid_at = CURRENT_TIMESTAMP, provider_ref = COALESCE(?, provider_ref) WHERE id = ?')
    .run(status, providerRef, purchaseId);
  if (p.product === 'report' && p.idea_id) {
    await startReport(p.idea_id, p.id);
  } else if (p.product === 'pro') {
    await db.prepare(`
      UPDATE users SET pro_until = datetime(MAX(COALESCE(pro_until, datetime('now')), datetime('now')), '+30 days'),
                       report_credits = report_credits + 1
      WHERE id = ?
    `).run(p.user_id);
  } else if (p.product === 'featured' && p.idea_id) {
    await db.prepare("UPDATE ideas SET featured_until = datetime('now', '+1 day') WHERE id = ?").run(p.idea_id);
  }
  return p;
}

export async function createCheckout(req, res, next) {
  try {
    const { product, idea_id } = req.body;
    let idea = null;
    if (product !== 'pro') {
      if (!idea_id) return res.status(400).json({ success: false, error: { message: 'Choose an idea.' } });
      const r = await ownIdea(req, idea_id);
      if (r.error) return res.status(r.error[0]).json({ success: false, error: { message: r.error[1] } });
      idea = r.idea;
    }
    if (product === 'featured' && (await featuredSlotsUsed()) >= FEATURED_SLOTS_PER_DAY) {
      return res.status(409).json({ success: false, error: { message: 'All 3 featured spots are taken right now. Please try again later.' } });
    }

    // Pro members spend their monthly report credit instead of paying.
    if (product === 'report') {
      const user = await db.prepare('SELECT report_credits FROM users WHERE id = ?').get(req.user.id);
      if (Number(user?.report_credits || 0) > 0) {
        await db.prepare('UPDATE users SET report_credits = report_credits - 1 WHERE id = ?').run(req.user.id);
        const purchase = await db.prepare("INSERT INTO purchases (user_id, idea_id, product, status, amount_cents) VALUES (?, ?, 'report', 'pending', 0)").run(req.user.id, idea.id);
        await fulfillPurchase(purchase.lastInsertRowid, 'granted');
        return res.json({ success: true, data: { started: true }, message: 'Report started with your Pro credit.' });
      }
    }

    if (!paymentsEnabled()) {
      return res.status(503).json({ success: false, error: { message: 'Payments are not switched on yet. Please check back soon.', code: 'PAYMENTS_DISABLED' } });
    }

    const purchase = await db.prepare('INSERT INTO purchases (user_id, idea_id, product, amount_cents) VALUES (?, ?, ?, ?)')
      .run(req.user.id, idea?.id || null, product, PRODUCTS[product].amount);
    const back = idea ? `/ideas/${idea.id}` : '/pricing';
    const session = await createCheckoutSession({
      product,
      purchaseId: purchase.lastInsertRowid,
      email: req.user.email,
      successPath: `${back}?paid=${product}`,
      cancelPath: back
    });
    await db.prepare('UPDATE purchases SET provider_ref = ? WHERE id = ?').run(session.id, purchase.lastInsertRowid);
    res.json({ success: true, data: { url: session.url } });
  } catch (err) { next(err); }
}

// Stripe webhook: the only place a payment is trusted. Needs the raw request body.
export async function stripeWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) {
    return res.status(400).send('Invalid signature');
  }
  try {
    const event = JSON.parse(raw);
    if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
      const purchaseId = Number(event.data.object.metadata?.purchase_id || event.data.object.client_reference_id);
      if (purchaseId) await fulfillPurchase(purchaseId, 'paid', event.data.object.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    res.status(500).send('Webhook handler failed');
  }
}

// Admin: free report (first 50 founders) or a month of Pro.
export async function grant(req, res, next) {
  try {
    const { product, user_id, idea_id } = req.body;
    let userId = user_id;
    if (product === 'report') {
      const idea = await db.prepare('SELECT id, user_id FROM ideas WHERE id = ?').get(idea_id || 0);
      if (!idea) return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
      userId = idea.user_id;
    }
    if (!userId) return res.status(400).json({ success: false, error: { message: 'Choose a user.' } });
    const purchase = await db.prepare("INSERT INTO purchases (user_id, idea_id, product, status, amount_cents) VALUES (?, ?, ?, 'pending', 0)")
      .run(userId, idea_id || null, product);
    await fulfillPurchase(purchase.lastInsertRowid, 'granted');
    res.json({ success: true, message: product === 'report' ? 'Free Validation Report started.' : 'One month of Pro granted.' });
  } catch (err) { next(err); }
}

export async function myPlan(req, res, next) {
  try {
    const row = await db.prepare(`
      SELECT pro_until, report_credits, (pro_until IS NOT NULL AND pro_until > datetime('now')) AS is_pro FROM users WHERE id = ?
    `).get(req.user.id);
    res.json({ success: true, data: { is_pro: Boolean(Number(row?.is_pro)), pro_until: row?.pro_until || null, report_credits: Number(row?.report_credits || 0) } });
  } catch (err) { next(err); }
}

// ---------- Validation Report ----------
function verdict(demand) {
  if (demand.total < 10) return 'Not enough votes yet for a verdict. Share your link to bring in more people.';
  if (demand.demand_score >= 60) return `Strong demand: ${demand.pay_rate}% said they would pay. Worth building a first version and charging from day one.`;
  if (demand.demand_score >= 35) return `Promising but mixed: ${demand.pay_rate}% would pay. Read the objections below and sharpen who it is for before building.`;
  return `Weak demand so far: only ${demand.pay_rate}% would pay. Consider a different buyer, a narrower problem, or a different idea.`;
}

async function buildReport(report, { includeEmails }) {
  const idea = await db.prepare('SELECT id, title, pitch, category, user_id FROM ideas WHERE id = ?').get(report.idea_id);
  let r = report;
  const demand = await getDemandSummary(idea.id);

  // Fewer than 25 votes after 7 days: one free 7-day extension.
  const ended = await db.prepare("SELECT (ends_at <= datetime('now')) AS ended FROM validation_reports WHERE id = ?").get(r.id);
  if (Number(ended.ended) && demand.total < REPORT_TARGET_VOTES && !Number(r.extended)) {
    await db.prepare(`UPDATE validation_reports SET ends_at = datetime('now', '+${REPORT_DAYS} days'), extended = 1 WHERE id = ?`).run(r.id);
    await db.prepare(`UPDATE ideas SET boosted_until = datetime('now', '+${REPORT_DAYS} days') WHERE id = ?`).run(idea.id);
    await notify(idea.user_id, 'report', `Your report for "${idea.title}" got a free 7-day extension`, `/ideas/${idea.id}/report`);
    r = await db.prepare('SELECT * FROM validation_reports WHERE id = ?').get(r.id);
  }
  const status = await db.prepare("SELECT (ends_at <= datetime('now')) AS ended FROM validation_reports WHERE id = ?").get(r.id);

  const objections = await db.prepare(`
    SELECT f.would_make_pay AS text, f.buyer_would_pay, u.role_tag
    FROM idea_feedback f JOIN users u ON u.id = f.user_id
    WHERE f.idea_id = ? AND COALESCE(TRIM(f.would_make_pay), '') != ''
    ORDER BY f.buyer_would_pay ASC, f.updated_at DESC LIMIT 5
  `).all(idea.id);
  const competitors = await db.prepare(`
    SELECT competitor AS name, COUNT(*) AS mentions FROM idea_feedback
    WHERE idea_id = ? AND COALESCE(TRIM(competitor), '') != '' GROUP BY LOWER(TRIM(competitor)) ORDER BY mentions DESC LIMIT 10
  `).all(idea.id);
  const waitlist = includeEmails ? await db.prepare(`
    SELECT u.name, u.email FROM demand_signals d JOIN users u ON u.id = d.user_id
    WHERE d.idea_id = ? AND d.join_waitlist = 1 AND d.held = 0 ORDER BY d.updated_at DESC
  `).all(idea.id) : null;

  const finished = Boolean(Number(status.ended));
  return {
    idea: { id: idea.id, title: idea.title, pitch: idea.pitch, category: idea.category },
    started_at: r.started_at,
    ends_at: r.ends_at,
    extended: Boolean(Number(r.extended)),
    finished,
    target_votes: REPORT_TARGET_VOTES,
    refund_eligible: finished && Boolean(Number(r.extended)) && demand.total < REPORT_TARGET_VOTES,
    public_token: r.public_token,
    demand,
    objections: objections.map((o) => ({ text: o.text, role: o.role_tag })),
    competitors: competitors.map((c) => ({ name: c.name, mentions: Number(c.mentions) })),
    waitlist,
    verdict: verdict(demand),
    badge_eligible: demand.demand_score >= BADGE_MIN_SCORE && demand.total >= BADGE_MIN_VOTES
  };
}

export async function getIdeaReport(req, res, next) {
  try {
    const idea = await db.prepare('SELECT id, user_id FROM ideas WHERE id = ?').get(Number(req.params.id));
    if (!idea) return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    if (Number(idea.user_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'Only the founder can see this report.' } });
    }
    const report = await db.prepare('SELECT * FROM validation_reports WHERE idea_id = ? ORDER BY id DESC LIMIT 1').get(idea.id);
    if (!report) return res.json({ success: true, data: { report: null } });
    res.json({ success: true, data: { report: await buildReport(report, { includeEmails: true }) } });
  } catch (err) { next(err); }
}

// Public shareable link: everything except the waitlist emails.
export async function getPublicReport(req, res, next) {
  try {
    const report = await db.prepare('SELECT * FROM validation_reports WHERE public_token = ?').get(String(req.params.token));
    if (!report) return res.status(404).json({ success: false, error: { message: 'Report not found.' } });
    res.json({ success: true, data: { report: await buildReport(report, { includeEmails: false }) } });
  } catch (err) { next(err); }
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Embeddable SVG badge, only for ideas that passed the bar.
export async function reportBadge(req, res, next) {
  try {
    const report = await db.prepare('SELECT idea_id FROM validation_reports WHERE public_token = ?').get(String(req.params.token));
    if (!report) return res.status(404).send('Not found');
    const demand = await getDemandSummary(report.idea_id);
    if (!(demand.demand_score >= BADGE_MIN_SCORE && demand.total >= BADGE_MIN_VOTES)) return res.status(404).send('Not validated');
    const right = escapeXml(`${demand.pay_rate}% would pay · ${demand.total} votes`);
    const w = 150 + right.length * 6.2;
    res.set('Content-Type', 'image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="24" role="img" aria-label="Validated on BusinessListe: ${right}">` +
      `<rect width="150" height="24" rx="4" fill="#1f2328"/><rect x="146" width="${Math.round(w - 146)}" height="24" rx="4" fill="#1a7f4b"/>` +
      `<text x="10" y="16" fill="#fff" font-family="Verdana,sans-serif" font-size="11">Validated on BusinessListe</text>` +
      `<text x="156" y="16" fill="#fff" font-family="Verdana,sans-serif" font-size="11">${right}</text></svg>`
    );
  } catch (err) { next(err); }
}

export const SITE = () => env.CLIENT_URL;
