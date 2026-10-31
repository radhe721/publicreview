import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';
import { signToken, COOKIE_NAME } from '../src/middleware/auth.js';
import { verifyStripeSignature } from '../src/services/payments.js';
import { mrrRangeFor, keywords } from '../src/controllers/ideaExtras.controller.js';
import { buildWeeklyDigest, renderDigest } from '../src/db/send-weekly-email.js';
import { testOutbox } from '../src/services/mailer.js';

const RUN = Date.now();
const users = [];
const ideas = [];
const repos = [];

async function makeUser(label, { admin = false } = {}) {
  const r = await db.prepare(`
    INSERT INTO users (name, email, password_hash, role, bio, created_at) VALUES (?, ?, 'x', ?, 'Tester', datetime('now', '-3 days'))
  `).run(`FS ${label}`, `fs_${label}_${RUN}@example.com`, admin ? 'admin' : 'user');
  const u = { id: r.lastInsertRowid, role: admin ? 'admin' : 'user', token_version: 0, email: `fs_${label}_${RUN}@example.com` };
  users.push(u.id);
  return { ...u, cookie: `${COOKIE_NAME}=${signToken(u)}` };
}

async function post(user, extra = {}) {
  const n = ideas.length + 1;
  const res = await request(app).post('/api/v1/ideas').set('Cookie', user.cookie).send({
    title: `FS idea ${n} invoice chaser ${RUN}`,
    pitch: `Pitch number ${n} for invoices ${RUN}`,
    description: `Freelancers chase invoices by hand. Description ${n} ${RUN}.`,
    category: 'Business',
    problem: 'Freelancers lose hours chasing late invoices.',
    target_buyer: 'Freelance designers',
    suggested_price: 12,
    ...extra
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  ideas.push(res.body.data.idea.id);
  return res.body.data.idea.id;
}

const api = (method, path, user) => {
  const r = request(app)[method](`/api/v1${path}`);
  return user ? r.set('Cookie', user.cookie) : r;
};

describe('Full spec: posting, community, moderation, launches, payments', () => {
  let founder, rater, rater2, rater3, admin, ideaId;

  before(async () => {
    await runMigrations();
    founder = await makeUser('founder');
    rater = await makeUser('rater');
    rater2 = await makeUser('rater2');
    rater3 = await makeUser('rater3');
    admin = await makeUser('admin', { admin: true });
    ideaId = await post(founder);
  });

  after(async () => {
    for (const id of repos) await db.prepare('DELETE FROM shared_repos WHERE id = ?').run(id);
    for (const id of ideas) await db.prepare('DELETE FROM ideas WHERE id = ?').run(id);
    for (const id of users) await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  test('Structured idea fields are saved and returned', async () => {
    const idea = (await api('get', `/ideas/${ideaId}`)).body.data.idea;
    assert.strictEqual(idea.problem, 'Freelancers lose hours chasing late invoices.');
    assert.strictEqual(idea.target_buyer, 'Freelance designers');
    assert.strictEqual(idea.suggested_price, 12);
    const filtered = (await api('get', `/ideas?price_min=10&price_max=15&search=${RUN}`)).body.data.ideas.map((i) => i.id);
    assert.ok(filtered.includes(ideaId));
    const none = (await api('get', `/ideas?price_min=50&search=${RUN}`)).body.data.ideas;
    assert.strictEqual(none.length, 0);
  });

  test('Drafts are private until published', async () => {
    const draftId = await post(founder, { status: 'draft' });
    assert.strictEqual((await api('get', `/ideas/${draftId}`)).status, 404);
    assert.strictEqual((await api('get', `/ideas/${draftId}`, founder)).status, 200);
    const drafts = (await api('get', '/ideas/drafts/mine', founder)).body.data.ideas.map((i) => i.id);
    assert.ok(drafts.includes(draftId));
    assert.strictEqual((await api('post', `/ideas/${draftId}/ratings`, rater).send({ score: 4 })).status, 404);
    await api('put', `/ideas/${draftId}`, founder).send({ status: 'published' });
    assert.strictEqual((await api('get', `/ideas/${draftId}`)).status, 200);
  });

  test('Edits keep the previous wording in the history', async () => {
    await api('put', `/ideas/${ideaId}`, founder).send({ pitch: `Changed pitch ${RUN}` });
    const revisions = (await api('get', `/ideas/${ideaId}/revisions`)).body.data.revisions;
    assert.strictEqual(revisions.length, 1);
    assert.match(revisions[0].pitch, /Pitch number 1/);
  });

  test('Duplicate check and similar ideas', async () => {
    const res = await api('get', `/ideas/similar-titles?q=${encodeURIComponent('invoice chaser for freelancers')}`);
    assert.ok(res.body.data.ideas.some((i) => i.id === ideaId));
    assert.deepStrictEqual(keywords('The best invoice tool for invoice chasing'), ['best', 'invoice', 'chasing']);
  });

  test('Spam filter: too many links and repeated text', async () => {
    const links = await api('post', `/ideas/${ideaId}/comments`, rater).send({ content: 'see http://a.com http://b.com http://c.com http://d.com' });
    assert.strictEqual(links.status, 400);
    const text = 'This is a long enough comment to count for repeats.';
    assert.strictEqual((await api('post', `/ideas/${ideaId}/comments`, rater).send({ content: text })).status, 201);
    assert.strictEqual((await api('post', `/ideas/${ideaId}/comments`, rater).send({ content: text })).status, 400);
  });

  test('Ratings give reputation, badges and notify the founder', async () => {
    await api('post', `/ideas/${ideaId}/ratings`, rater).send({ score: 4 });
    const rep = (await api('get', `/users/${rater.id}/reputation`)).body.data;
    assert.strictEqual(rep.reputation, 1);
    assert.ok(rep.badges.some((b) => b.id === 'first_rating'));
    const notes = (await api('get', '/notifications', founder)).body.data;
    assert.ok(notes.unread >= 2, 'comment + vote notifications');
    assert.ok(notes.notifications.some((n) => n.type === 'vote'));
    await api('post', '/notifications/read', founder);
    assert.strictEqual((await api('get', '/notifications', founder)).body.data.unread, 0);
  });

  test('Notification settings turn types off', async () => {
    const res = await api('put', '/notifications/prefs', founder).send({ vote: { inapp: false } });
    assert.strictEqual(res.body.data.prefs.vote.inapp, false);
    await api('post', `/ideas/${ideaId}/ratings`, rater2).send({ score: 5 });
    const notes = (await api('get', '/notifications', founder)).body.data.notifications;
    assert.ok(!notes.some((n) => n.type === 'vote' && !n.read_at));
  });

  test('Founder marks feedback helpful: +5 for the rater', async () => {
    await api('put', `/ideas/${ideaId}/feedback`, rater).send({ problem_real: 4, buyer_would_pay: 4, would_make_pay: 'Stripe sync' });
    assert.strictEqual((await api('post', `/ideas/${ideaId}/feedback/${rater.id}/helpful`, rater2)).status, 403);
    await api('post', `/ideas/${ideaId}/feedback/${rater.id}/helpful`, founder);
    assert.strictEqual((await api('get', `/users/${rater.id}/reputation`)).body.data.reputation, 6);
    const contributors = (await api('get', '/contributors')).body.data.contributors;
    assert.ok(contributors.some((c) => c.id === rater.id && c.month_points === 6));
  });

  test('I want to build this: founder sees who, others see a count', async () => {
    await api('put', `/ideas/${ideaId}/build`, rater).send({ note: 'I build invoicing tools' });
    const pub = (await api('get', `/ideas/${ideaId}/build`, rater2)).body.data;
    assert.strictEqual(pub.count, 1);
    assert.strictEqual(pub.builders, null);
    const own = (await api('get', `/ideas/${ideaId}/build`, founder)).body.data;
    assert.strictEqual(own.builders[0].note, 'I build invoicing tools');
  });

  test('Comment upvotes and auto-hide after 3 reports', async () => {
    const c = await api('post', `/ideas/${ideaId}/comments`, rater2).send({ content: `A comment to upvote and report ${RUN}` });
    const commentId = c.body.data.comment.id;
    const up = await api('post', `/ideas/comments/${commentId}/upvote`, rater);
    assert.strictEqual(up.body.data.upvotes, 1);
    for (const u of [rater, founder, rater3]) {
      await api('post', '/content-reports', u).send({ target_type: 'comment', target_id: commentId, reason: 'Spam content here' });
    }
    const comments = (await api('get', `/ideas/${ideaId}/comments`)).body.data.comments;
    assert.ok(!comments.some((x) => x.id === commentId));
    await api('patch', `/admin/hide/comment/${commentId}`, admin).send({ hidden: false });
    const after = (await api('get', `/ideas/${ideaId}/comments`)).body.data.comments;
    assert.ok(after.some((x) => x.id === commentId));
  });

  test('Ideas auto-hide after 3 reports; admins can restore and recategorize', async () => {
    const victim = await post(founder);
    for (const u of [rater, rater2, rater3]) {
      await api('post', '/reports', u).send({ idea_id: victim, reason: 'Looks like an advert' });
    }
    assert.strictEqual((await api('get', `/ideas/${victim}`)).status, 404);
    await api('patch', `/admin/ideas/${victim}`, admin).send({ status: 'published', category: 'Tech' });
    const idea = (await api('get', `/ideas/${victim}`)).body.data.idea;
    assert.strictEqual(idea.category, 'Tech');
    assert.strictEqual((await api('get', '/admin/overview', founder)).status, 403);
    const overview = (await api('get', '/admin/overview', admin)).body.data;
    assert.ok(overview.counts.users > 0 && Array.isArray(overview.purchases));
  });

  test('Repo comments, search and co-founder board', async () => {
    const r = await db.prepare(`
      INSERT INTO shared_repos (user_id, github_id, full_name, description, stars, category) VALUES (?, ?, ?, 'Invoice chasing for freelancers', 10, 'Billing')
    `).run(rater.id, RUN, `fs/invoice-${RUN}`);
    repos.push(r.lastInsertRowid);
    assert.strictEqual((await api('post', `/repos/${r.lastInsertRowid}/comments`, founder).send({ content: 'Nice project for invoices' })).status, 201);
    assert.strictEqual((await api('get', `/repos/${r.lastInsertRowid}/comments`)).body.data.comments.length, 1);
    const related = (await api('get', `/repos/${r.lastInsertRowid}/ideas`)).body.data.ideas;
    assert.ok(related.some((i) => i.id === ideaId));

    const found = (await api('get', `/search?q=${RUN}`)).body.data;
    assert.ok(found.ideas.length > 0 && found.repos.length > 0);

    await api('put', '/cofounders', rater).send({ skills: 'React, Node', looking_for: 'A B2B SaaS co-founder', contact: 'me@example.com' });
    const anon = (await api('get', '/cofounders')).body.data.posts.find((p) => p.user_id === rater.id);
    assert.strictEqual(anon.contact, null);
    const signed = (await api('get', '/cofounders', founder)).body.data.posts.find((p) => p.user_id === rater.id);
    assert.strictEqual(signed.contact, 'me@example.com');
  });

  test('Launch tracking and revenue verification rules', async () => {
    assert.strictEqual((await api('put', `/ideas/${ideaId}/launch`, rater).send({ launched_url: 'https://x.io', launched_at: '2026-10-01' })).status, 403);
    await api('put', `/ideas/${ideaId}/launch`, founder).send({ launched_url: 'https://invoice.example', launched_at: '2026-10-01', mrr_range: '1k_5k' });
    const launches = (await api('get', '/ideas/launches')).body.data.launches;
    const mine = launches.find((l) => l.id === ideaId);
    assert.strictEqual(mine.launch.mrr_range, '1k_5k');
    assert.strictEqual(mine.launch.verified, false);
    // Full secret keys are refused; only restricted read-only keys are accepted.
    const bad = await api('post', `/ideas/${ideaId}/verify-revenue`, founder).send({ stripe_key: 'sk_live_abc123' });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(mrrRangeFor(250000), '1k_5k');
    assert.strictEqual(mrrRangeFor(0), 'pre_revenue');
  });

  test('Payments are off without a key; admin grant starts a report', async () => {
    const config = (await api('get', '/payments/config')).body.data;
    assert.strictEqual(config.enabled, false);
    const checkout = await api('post', '/payments/checkout', founder).send({ product: 'report', idea_id: ideaId });
    assert.strictEqual(checkout.status, 503);

    await api('post', '/admin/grant', admin).send({ product: 'report', idea_id: ideaId });
    const report = (await api('get', `/ideas/${ideaId}/report`, founder)).body.data.report;
    assert.ok(report && report.public_token);
    assert.ok(Array.isArray(report.waitlist));
    assert.strictEqual((await api('get', `/ideas/${ideaId}/report`, rater)).status, 403);
    const pub = (await api('get', `/reports/public/${report.public_token}`)).body.data.report;
    assert.strictEqual(pub.waitlist, null, 'public link never shows emails');
    assert.ok(pub.verdict);
    assert.strictEqual((await api('get', `/reports/public/${report.public_token}/badge.svg`)).status, 404);
    const idea = (await api('get', `/ideas/${ideaId}`)).body.data.idea;
    assert.strictEqual(idea.is_boosted, true);
  });

  test('Pro: analytics, credits and landing page', async () => {
    assert.strictEqual((await api('get', `/ideas/${ideaId}/analytics`, founder)).status, 402);
    assert.strictEqual((await api('get', `/ideas/${ideaId}/landing`)).status, 404);
    await api('post', '/admin/grant', admin).send({ product: 'pro', user_id: founder.id });
    const plan = (await api('get', '/payments/me', founder)).body.data;
    assert.strictEqual(plan.is_pro, true);
    assert.strictEqual(plan.report_credits, 1);

    await api('post', `/ideas/${ideaId}/view`).set('Origin', 'http://localhost:5173').send({ referrer: 'https://www.reddit.com/r/SideProject' });
    const stats = (await api('get', `/ideas/${ideaId}/analytics`, founder)).body.data;
    assert.ok(stats.referrers.some((r) => r.referrer === 'reddit.com'));

    assert.strictEqual((await api('get', `/ideas/${ideaId}/landing`)).status, 200);
    await api('post', `/ideas/${ideaId}/landing/signup`).send({ email: 'Lead@Example.com' });
    const signups = (await api('get', `/ideas/${ideaId}/landing/signups`, founder)).body.data.signups;
    assert.strictEqual(signups[0].email, 'lead@example.com');

    const other = await post(founder);
    const credit = await api('post', '/payments/checkout', founder).send({ product: 'report', idea_id: other });
    assert.strictEqual(credit.status, 200);
    assert.strictEqual(credit.body.data.started, true);
  });

  test('Stripe webhook signatures are verified', async () => {
    const secret = 'whsec_test';
    const body = '{"type":"ping"}';
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    assert.strictEqual(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret), true);
    assert.strictEqual(verifyStripeSignature(body, `t=${t},v1=${'0'.repeat(64)}`, secret), false);
    assert.strictEqual(verifyStripeSignature(body, `t=${t - 1000},v1=${sig}`, secret), false);
    const res = await request(app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', 'bad').send(body);
    assert.strictEqual(res.status, 400);
  });

  test('Weekly email digest and unsubscribe', async () => {
    await api('put', `/ideas/${ideaId}/demand`, rater).send({ intent: 'would_pay', price_tier: '5_15' });
    const digest = await buildWeeklyDigest();
    const text = renderDigest(digest, 'https://x/unsub');
    assert.match(text, /Top validated ideas this week/);
    assert.match(text, /Unsubscribe: https:\/\/x\/unsub/);

    const email = `fs_sub_${RUN}@example.com`;
    await api('post', '/waitlist').send({ email });
    const row = await db.prepare('SELECT unsubscribe_token FROM waitlist_signups WHERE email = ?').get(email);
    assert.ok(row.unsubscribe_token);
    assert.strictEqual((await api('post', `/unsubscribe?token=${row.unsubscribe_token}`)).status, 200);
    const after = await db.prepare('SELECT unsubscribed_at FROM waitlist_signups WHERE email = ?').get(email);
    assert.ok(after.unsubscribed_at);
    await db.prepare('DELETE FROM waitlist_signups WHERE email = ?').run(email);
    assert.ok(Array.isArray(testOutbox));
  });
});
