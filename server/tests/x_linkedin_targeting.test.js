import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { signToken, COOKIE_NAME } from '../src/middleware/auth.js';

const RUN = Date.now();
const users = [];
const ideas = [];

function cookieValue(setCookie, name) {
  const c = (setCookie || []).find((x) => x.startsWith(`${name}=`));
  return c ? c.split(';')[0] : null;
}

async function makeUser(label, extra = {}) {
  const r = await db.prepare(`
    INSERT INTO users (name, email, password_hash, role, bio, role_tag, industry, created_at)
    VALUES (?, ?, 'x', ?, 'Tester', ?, ?, datetime('now', '-3 days'))
  `).run(`XL ${label}`, `xl_${label}_${RUN}@example.com`, extra.admin ? 'admin' : 'user', extra.role_tag || null, extra.industry || null);
  const u = { id: r.lastInsertRowid, role: extra.admin ? 'admin' : 'user', token_version: 0 };
  users.push(u.id);
  return { ...u, cookie: `${COOKIE_NAME}=${signToken(u)}` };
}

describe('X and LinkedIn sign-in, account linking, verified badges', () => {
  const realFetch = globalThis.fetch;
  let fake;

  before(async () => {
    await runMigrations();
    Object.assign(env, { X_CLIENT_ID: 'x-id', X_CLIENT_SECRET: 'x-secret', LINKEDIN_CLIENT_ID: 'li-id', LINKEDIN_CLIENT_SECRET: 'li-secret' });
    globalThis.fetch = async (url, opts = {}) => {
      const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const u = String(url);
      if (u === 'https://api.x.com/2/oauth2/token') {
        assert.match(opts.headers.Authorization, /^Basic /, 'X token call uses Basic auth');
        return json({ access_token: 'x-token' });
      }
      if (u.startsWith('https://api.x.com/2/users/me')) return json({ data: fake.x });
      if (u === 'https://www.linkedin.com/oauth/v2/accessToken') return json({ access_token: 'li-token' });
      if (u === 'https://api.linkedin.com/v2/userinfo') return json(fake.linkedin);
      throw new Error(`Unexpected fetch ${u}`);
    };
  });

  after(async () => {
    globalThis.fetch = realFetch;
    Object.assign(env, { X_CLIENT_ID: '', X_CLIENT_SECRET: '', LINKEDIN_CLIENT_ID: '', LINKEDIN_CLIENT_SECRET: '' });
    for (const id of users) await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  async function flow(provider, { cookie, link = false, redirect = '/feed' } = {}) {
    let start = request(app).get(`/api/v1/auth/oauth/${provider}?redirect=${encodeURIComponent(redirect)}${link ? '&link=1' : ''}`);
    if (cookie) start = start.set('Cookie', cookie);
    start = await start;
    assert.strictEqual(start.status, 302);
    const loc = new URL(start.headers.location);
    const stateCookie = cookieValue(start.headers['set-cookie'], 'ideapulse_oauth');
    const callback = await request(app)
      .get(`/api/v1/auth/oauth/${provider}/callback?code=abc&state=${encodeURIComponent(loc.searchParams.get('state'))}`)
      .set('Cookie', stateCookie);
    return { loc, callback };
  }

  test('Providers endpoint lists X and LinkedIn when configured', async () => {
    const res = await request(app).get('/api/v1/auth/providers');
    assert.strictEqual(res.body.data.providers.x, true);
    assert.strictEqual(res.body.data.providers.linkedin, true);
  });

  test('X start uses x.com with PKCE and the email scope', async () => {
    const { loc } = await flow('x');
    assert.strictEqual(loc.origin, 'https://x.com');
    assert.strictEqual(loc.searchParams.get('code_challenge_method'), 'S256');
    assert.match(loc.searchParams.get('scope'), /users\.email/);
  });

  test('X sign-in with a confirmed email creates an account', async () => {
    fake = { x: { id: `x-${RUN}`, name: 'Xavier', username: `xav${RUN}`, confirmed_email: `xav_${RUN}@example.com` } };
    const { callback } = await flow('x');
    assert.strictEqual(callback.status, 302);
    assert.ok(cookieValue(callback.headers['set-cookie'], COOKIE_NAME), 'session cookie set');
    const u = await db.prepare('SELECT id FROM users WHERE email = ?').get(`xav_${RUN}@example.com`);
    users.push(u.id);
  });

  test('X sign-in without an email is refused with a helpful error', async () => {
    fake = { x: { id: `x2-${RUN}`, name: 'No Mail', username: 'nomail' } };
    const { callback } = await flow('x');
    assert.match(callback.headers.location, /error=oauth_email_unverified/);
  });

  test('LinkedIn sign-in uses the OpenID userinfo', async () => {
    fake = { linkedin: { sub: `li-${RUN}`, name: 'Lina Linked', email: `lina_${RUN}@example.com`, email_verified: true } };
    const { loc, callback } = await flow('linkedin');
    assert.strictEqual(loc.origin, 'https://www.linkedin.com');
    assert.ok(cookieValue(callback.headers['set-cookie'], COOKIE_NAME));
    const u = await db.prepare('SELECT id FROM users WHERE email = ?').get(`lina_${RUN}@example.com`);
    users.push(u.id);
  });

  test('Signed-in users connect X (no email needed) and get a verified badge', async () => {
    const me = await makeUser('linker');
    fake = { x: { id: `x3-${RUN}`, name: 'Linker', username: 'linker_x' } };
    const { callback } = await flow('x', { cookie: me.cookie, link: true, redirect: `/profile/${me.id}` });
    assert.strictEqual(callback.headers.location.endsWith(`/profile/${me.id}?linked=x`), true, callback.headers.location);
    const rep = (await request(app).get(`/api/v1/users/${me.id}/reputation`)).body.data;
    assert.deepStrictEqual(rep.linked, [{ provider: 'x', username: 'linker_x' }]);

    // The same X account cannot be connected to someone else.
    const other = await makeUser('other');
    const second = await flow('x', { cookie: other.cookie, link: true });
    assert.match(second.callback.headers.location, /error=oauth_identity_taken/);

    assert.strictEqual((await request(app).delete('/api/v1/linked-accounts/x').set('Cookie', me.cookie)).status, 200);
    assert.deepStrictEqual((await request(app).get(`/api/v1/users/${me.id}/reputation`)).body.data.linked, []);
  });
});

describe('Pro targeted raters', () => {
  let founder, admin, dentistRater, devRater, ideaId;

  before(async () => {
    await runMigrations();
    founder = await makeUser('tfounder');
    admin = await makeUser('tadmin', { admin: true });
    dentistRater = await makeUser('tdentist', { role_tag: 'operator', industry: 'Healthcare' });
    devRater = await makeUser('tdev', { role_tag: 'developer' });
    const res = await request(app).post('/api/v1/ideas').set('Cookie', founder.cookie).send({
      title: `Targeted clinic rota idea ${RUN}`, pitch: `Clinic rota pitch ${RUN}`,
      description: `Clinics need rotas. Targeted test ${RUN}.`, category: 'Business'
    });
    ideaId = res.body.data.idea.id;
    ideas.push(ideaId);
  });

  after(async () => {
    for (const id of ideas) await db.prepare('DELETE FROM ideas WHERE id = ?').run(id);
    for (const id of users) await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  test('Targeting is a Pro feature', async () => {
    const res = await request(app).put(`/api/v1/ideas/${ideaId}/targeting`).set('Cookie', founder.cookie).send({ target_roles: ['operator'] });
    assert.strictEqual(res.status, 402);
  });

  test('Pro founder targets operators in Healthcare: they are notified and see it first', async () => {
    await request(app).post('/api/v1/admin/grant').set('Cookie', admin.cookie).send({ product: 'pro', user_id: founder.id });
    const res = await request(app).put(`/api/v1/ideas/${ideaId}/targeting`).set('Cookie', founder.cookie)
      .send({ target_roles: ['operator'], target_industry: 'Healthcare' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.notified >= 1);

    const notes = (await request(app).get('/api/v1/notifications').set('Cookie', dentistRater.cookie)).body.data.notifications;
    assert.ok(notes.some((n) => n.type === 'targeted' && n.link === `/ideas/${ideaId}`));
    const devNotes = (await request(app).get('/api/v1/notifications').set('Cookie', devRater.cookie)).body.data.notifications;
    assert.ok(!devNotes.some((n) => n.link === `/ideas/${ideaId}`), 'non-matching raters are not notified');

    // Saving again does not notify the same rater twice.
    const again = await request(app).put(`/api/v1/ideas/${ideaId}/targeting`).set('Cookie', founder.cookie)
      .send({ target_roles: ['operator'], target_industry: 'Healthcare' });
    assert.strictEqual(again.body.data.notified, 0);

    const feed = (await request(app).get('/api/v1/ideas?sort=needs_votes&limit=50').set('Cookie', dentistRater.cookie)).body.data.ideas;
    assert.strictEqual(feed[0].id, ideaId, 'targeted idea is first for a matching rater');
    assert.deepStrictEqual(feed[0].target_roles, ['operator']);
  });
});
