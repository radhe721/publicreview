import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';
import { signToken, COOKIE_NAME } from '../src/middleware/auth.js';
import { licenseNote } from '../src/services/github.js';
import { MIN_RATINGS_TO_RANK } from '../src/services/ranking.js';

const RUN = Date.now();
const createdUsers = [];
const createdIdeas = [];

// Users are inserted directly (faster than /register and not subject to its rate limit).
// established = account older than 24 hours with a profile, so its votes count fully.
async function makeUser(label, { established = false, admin = false } = {}) {
  const result = await db.prepare(`
    INSERT INTO users (name, email, password_hash, role, bio, created_at)
    VALUES (?, ?, 'x', ?, ?, ${established ? "datetime('now', '-3 days')" : 'CURRENT_TIMESTAMP'})
  `).run(`P1 ${label}`, `p1_${label}_${RUN}@example.com`, admin ? 'admin' : 'user', established ? 'Operator who rates ideas.' : null);
  const user = { id: result.lastInsertRowid, role: admin ? 'admin' : 'user', token_version: 0 };
  createdUsers.push(user.id);
  return { ...user, cookie: `${COOKIE_NAME}=${signToken(user)}` };
}

async function makeIdea(author, title) {
  const res = await request(app).post('/api/v1/ideas').set('Cookie', author.cookie).send({
    title,
    pitch: 'A one-line pitch for the phase one tests',
    description: 'A description long enough to pass validation for the phase one test suite.',
    category: 'Business'
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  createdIdeas.push(res.body.data.idea.id);
  return res.body.data.idea.id;
}

async function rate(user, ideaId, score) {
  const res = await request(app).post(`/api/v1/ideas/${ideaId}/ratings`).set('Cookie', user.cookie).send({ score });
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

async function getIdea(ideaId) {
  return (await request(app).get(`/api/v1/ideas/${ideaId}`)).body.data.idea;
}

describe('Phase 1: ranking, vote integrity, feedback, team seed, roles', () => {
  let author, admin, established, newcomers;
  let fewVotesId, manyVotesId, lowWeightId, fullWeightId, burstId;

  before(async () => {
    await runMigrations();
    author = await makeUser('author', { established: true });
    admin = await makeUser('admin', { established: true, admin: true });
    established = [];
    for (let i = 0; i < 5; i++) established.push(await makeUser(`est${i}`, { established: true }));
    newcomers = [];
    for (let i = 0; i < 7; i++) newcomers.push(await makeUser(`new${i}`));

    fewVotesId = await makeIdea(author, `P1 Few votes ${RUN}`);
    manyVotesId = await makeIdea(author, `P1 Many votes ${RUN}`);
    lowWeightId = await makeIdea(author, `P1 Low weight ${RUN}`);
    fullWeightId = await makeIdea(author, `P1 Full weight ${RUN}`);
    burstId = await makeIdea(author, `P1 Burst ${RUN}`);
  });

  after(async () => {
    for (const id of createdIdeas) await db.prepare('DELETE FROM ideas WHERE id = ?').run(id);
    for (const id of createdUsers) await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  test('An idea with 2 perfect ratings is not ranked; 5 ratings of 4.6 is', async () => {
    await rate(established[0], fewVotesId, 5);
    await rate(established[1], fewVotesId, 5);
    for (const [i, score] of [5, 5, 4, 4, 5].entries()) await rate(established[i], manyVotesId, score);

    const few = await getIdea(fewVotesId);
    assert.strictEqual(few.stats.needs_votes, true);
    assert.strictEqual(few.stats.votes_to_rank, MIN_RATINGS_TO_RANK - 2);

    const many = await getIdea(manyVotesId);
    assert.strictEqual(many.stats.needs_votes, false);
    // Bayesian average: (sum of weighted scores + 5 x site mean) / (weighted votes + 5).
    const { mean } = await db.prepare('SELECT AVG(CAST(score AS REAL)) AS mean FROM ratings WHERE held = 0').get();
    const expected = (23 + 5 * Number(mean)) / 10;
    assert.ok(Math.abs(many.stats.ranking_score - expected) < 0.001, `${many.stats.ranking_score} vs ${expected}`);

    const board = (await request(app).get('/api/v1/leaderboard?timeframe=all&limit=100')).body.data;
    const ids = board.leaderboard.map((i) => i.id);
    assert.ok(ids.includes(manyVotesId));
    assert.ok(!ids.includes(fewVotesId), 'ideas under the minimum never appear in Top lists');
    for (let i = 0; i < board.leaderboard.length - 1; i++) {
      assert.ok(board.leaderboard[i].stats.ranking_score >= board.leaderboard[i + 1].stats.ranking_score);
    }

    // Feed "top": the ranked idea comes before the 2-vote idea even though its average is lower.
    const feed = (await request(app).get(`/api/v1/ideas?sort=top&search=${RUN}&limit=50`)).body.data.ideas.map((i) => i.id);
    assert.ok(feed.indexOf(manyVotesId) < feed.indexOf(fewVotesId));

    // ranked_only hides it; needs_votes shows only ideas under the minimum.
    const rankedOnly = (await request(app).get(`/api/v1/ideas?sort=top&ranked_only=true&search=${RUN}`)).body.data.ideas.map((i) => i.id);
    assert.deepStrictEqual(rankedOnly, [manyVotesId]);
    const needs = (await request(app).get(`/api/v1/ideas?sort=needs_votes&search=${RUN}`)).body.data.ideas.map((i) => i.id);
    assert.ok(needs.includes(fewVotesId) && !needs.includes(manyVotesId));
  });

  test('Votes from brand-new, profile-less accounts count less', async () => {
    for (let i = 0; i < 5; i++) await rate(newcomers[i], lowWeightId, 5);
    for (let i = 0; i < 5; i++) await rate(established[i], fullWeightId, 5);
    const low = await getIdea(lowWeightId);
    const full = await getIdea(fullWeightId);
    assert.strictEqual(low.stats.avg_score, 5);
    assert.strictEqual(full.stats.avg_score, 5);
    assert.ok(full.stats.ranking_score > low.stats.ranking_score, `${full.stats.ranking_score} > ${low.stats.ranking_score}`);
  });

  test('A burst of votes from new accounts is held, and an admin can release it', async () => {
    const results = [];
    for (const voter of newcomers) results.push(await rate(voter, burstId, 4));
    assert.match(results[6].message, /reviewed/);

    let idea = await getIdea(burstId);
    assert.strictEqual(idea.stats.total_ratings, 5, 'the 6th and 7th rating in the burst are held');

    // Demand votes follow the same rule.
    for (const voter of newcomers) {
      await request(app).put(`/api/v1/ideas/${burstId}/demand`).set('Cookie', voter.cookie).send({ intent: 'would_pay', price_tier: '5_15' });
    }
    const demand = (await request(app).get(`/api/v1/ideas/${burstId}/demand`)).body.data.demand;
    assert.strictEqual(demand.total, 5);

    assert.strictEqual((await request(app).get('/api/v1/admin/held-votes').set('Cookie', author.cookie)).status, 403);
    const held = (await request(app).get('/api/v1/admin/held-votes').set('Cookie', admin.cookie)).body.data.votes
      .filter((v) => v.idea_id === burstId);
    assert.strictEqual(held.length, 4);

    const rating = held.find((v) => v.kind === 'rating');
    const release = await request(app).post(`/api/v1/admin/held-votes/rating/${rating.id}`).set('Cookie', admin.cookie).send({ action: 'release' });
    assert.strictEqual(release.status, 200);
    idea = await getIdea(burstId);
    assert.strictEqual(idea.stats.total_ratings, 6);

    const demandVote = held.find((v) => v.kind === 'demand');
    await request(app).post(`/api/v1/admin/held-votes/demand/${demandVote.id}`).set('Cookie', admin.cookie).send({ action: 'delete' });
    const remaining = (await request(app).get('/api/v1/admin/held-votes').set('Cookie', admin.cookie)).body.data.votes
      .filter((v) => v.idea_id === burstId);
    assert.strictEqual(remaining.length, 2);
  });

  test('Structured feedback: four questions, summary, no self-feedback', async () => {
    const self = await request(app).put(`/api/v1/ideas/${manyVotesId}/feedback`).set('Cookie', author.cookie)
      .send({ problem_real: 5, buyer_would_pay: 5 });
    assert.strictEqual(self.status, 400);

    const bad = await request(app).put(`/api/v1/ideas/${manyVotesId}/feedback`).set('Cookie', established[0].cookie)
      .send({ problem_real: 9, buyer_would_pay: 2 });
    assert.strictEqual(bad.status, 400);

    await request(app).put(`/api/v1/ideas/${manyVotesId}/feedback`).set('Cookie', established[0].cookie)
      .send({ problem_real: 4, buyer_would_pay: 3, price_fit: 'too_high', competitor: 'Acme Forms', would_make_pay: 'A Zapier integration' });
    const res = await request(app).put(`/api/v1/ideas/${manyVotesId}/feedback`).set('Cookie', established[1].cookie)
      .send({ problem_real: 5, buyer_would_pay: 4, price_fit: 'right' });
    assert.strictEqual(res.status, 200);

    const fb = res.body.data.feedback;
    assert.strictEqual(fb.total, 2);
    assert.strictEqual(fb.problem_real_avg, 4.5);
    assert.strictEqual(fb.buyer_would_pay_avg, 3.5);
    assert.deepStrictEqual(fb.price_fit, { too_low: 0, right: 1, too_high: 1 });
    assert.strictEqual(fb.competitors[0].text, 'Acme Forms');
    assert.strictEqual(fb.would_make_pay[0].text, 'A Zapier integration');
    assert.strictEqual(res.body.data.my_feedback.problem_real, 5);

    const del = await request(app).delete(`/api/v1/ideas/${manyVotesId}/feedback`).set('Cookie', established[1].cookie);
    assert.strictEqual(del.body.data.feedback.total, 1);
  });

  test('Admins can label an idea as team seed; it shows as BusinessListe Team', async () => {
    assert.strictEqual((await request(app).patch(`/api/v1/ideas/${fewVotesId}/team-seed`).set('Cookie', author.cookie).send({ is_team_seed: true })).status, 403);
    const res = await request(app).patch(`/api/v1/ideas/${fewVotesId}/team-seed`).set('Cookie', admin.cookie).send({ is_team_seed: true });
    assert.strictEqual(res.status, 200);
    const idea = await getIdea(fewVotesId);
    assert.strictEqual(idea.is_team_seed, true);
    assert.strictEqual(idea.author.name, 'BusinessListe Team');
    assert.strictEqual(idea.author.is_team, true);
  });

  test('Voters set a role tag; demand results show votes by role', async () => {
    const bad = await request(app).patch('/api/v1/users/me').set('Cookie', established[2].cookie).send({ role_tag: 'wizard' });
    assert.strictEqual(bad.status, 400);
    const ok = await request(app).patch('/api/v1/users/me').set('Cookie', established[2].cookie).send({ role_tag: 'freelancer' });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.data.user.role_tag, 'freelancer');

    await request(app).put(`/api/v1/ideas/${manyVotesId}/demand`).set('Cookie', established[2].cookie).send({ intent: 'would_pay', price_tier: '30_100' });
    const demand = (await request(app).get(`/api/v1/ideas/${manyVotesId}/demand`)).body.data.demand;
    assert.deepStrictEqual(demand.by_role.find((r) => r.role === 'freelancer'), { role: 'freelancer', total: 1, would_pay: 1 });
    assert.deepStrictEqual(demand.median_price, { tier: '30_100', label: '$30–100' });
  });

  test('License notes are plain English', () => {
    assert.match(licenseNote('MIT'), /almost anything/);
    assert.match(licenseNote('AGPL-3.0'), /run it as a service/);
    assert.match(licenseNote(null), /read it/i);
  });

  test('Repo facets endpoint answers', async () => {
    const res = await request(app).get('/api/v1/repos/facets');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data.categories));
    assert.ok(Array.isArray(res.body.data.licenses));
  });
});
