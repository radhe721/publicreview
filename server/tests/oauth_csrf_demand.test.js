import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { runMigrations } from '../src/db/migrate.js';
import db from '../src/config/db.js';

function cookieValue(setCookieHeaders, name) {
  const header = (setCookieHeaders || []).find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0] : null;
}

async function registerUser(label) {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: `${label} User`,
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`,
    password: 'Password123!'
  });
  return { user: res.body.data.user, cookie: cookieValue(res.headers['set-cookie'], 'ideapulse_token') };
}

describe('CORS & CSRF hardening', () => {
  before(async () => {
    await runMigrations();
  });

  test('CORS does not allow arbitrary *.vercel.app / *.onrender.com origins', async () => {
    for (const origin of ['https://evil.vercel.app', 'https://attacker.onrender.com']) {
      const res = await request(app).get('/api/v1/auth/me').set('Origin', origin);
      assert.strictEqual(res.headers['access-control-allow-origin'], undefined, origin);
    }
  });

  test('CORS allows the configured client origin with credentials', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Origin', 'http://localhost:5173');
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
  });

  test('State-changing requests from a foreign origin are rejected with 403', async () => {
    const { cookie } = await registerUser('csrf');
    const res = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({
        title: 'Forged idea attempt',
        pitch: 'This should never be created by a forged request',
        description: 'A cross-site request forgery attempt that must be blocked by the API.',
        category: 'Tech'
      });
    assert.strictEqual(res.status, 403);

    const nullOrigin = await request(app).post('/api/v1/auth/logout').set('Origin', 'null');
    assert.strictEqual(nullOrigin.status, 403);
  });

  test('Form-encoded bodies are not parsed (JSON-only API)', async () => {
    const { cookie } = await registerUser('formpost');
    const res = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', cookie)
      .type('form')
      .send('title=Form+idea+title&pitch=Pitch+text+here+ok&description=Long+enough+description+text+here&category=Tech');
    assert.strictEqual(res.status, 400);
  });
});

describe('Session security', () => {
  before(async () => {
    await runMigrations();
  });

  test('logout-all revokes previously issued tokens', async () => {
    const { cookie } = await registerUser('revoke');
    assert.strictEqual((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).body.data.user !== null, true);

    const res = await request(app).post('/api/v1/auth/logout-all').set('Cookie', cookie);
    assert.strictEqual(res.status, 200);

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    assert.strictEqual(me.body.data.user, null);
    const protectedRes = await request(app).post('/api/v1/ideas').set('Cookie', cookie).send({});
    assert.strictEqual(protectedRes.status, 401);
  });

  test('Passwords shorter than 8 characters are rejected at signup', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Short Pass',
      email: `shortpass_${Date.now()}@test.com`,
      password: 'abc123'
    });
    assert.strictEqual(res.status, 400);
  });
});

describe('OAuth sign-in (Google & GitHub)', () => {
  const realFetch = globalThis.fetch;
  let fakeProfile;

  before(async () => {
    await runMigrations();
    Object.assign(env, {
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      GITHUB_CLIENT_ID: 'test-github-id',
      GITHUB_CLIENT_SECRET: 'test-github-secret'
    });

    globalThis.fetch = async (url) => {
      const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (String(url).includes('token')) return json({ access_token: 'fake-access-token' });
      if (String(url).includes('userinfo')) return json(fakeProfile.google);
      if (String(url).endsWith('/user')) return json(fakeProfile.github);
      if (String(url).endsWith('/user/emails')) return json(fakeProfile.githubEmails);
      throw new Error(`Unexpected fetch ${url}`);
    };
  });

  after(() => {
    globalThis.fetch = realFetch;
    Object.assign(env, { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '' });
  });

  async function runFlow(provider, redirect = '/submit') {
    const start = await request(app).get(`/api/v1/auth/oauth/${provider}?redirect=${encodeURIComponent(redirect)}`);
    assert.strictEqual(start.status, 302);
    const location = new URL(start.headers.location);
    const state = location.searchParams.get('state');
    const stateCookie = cookieValue(start.headers['set-cookie'], 'ideapulse_oauth');
    assert.ok(state && stateCookie);
    const callback = await request(app)
      .get(`/api/v1/auth/oauth/${provider}/callback?code=abc&state=${encodeURIComponent(state)}`)
      .set('Cookie', stateCookie);
    return { start, location, callback };
  }

  test('providers endpoint reports configured providers', async () => {
    const res = await request(app).get('/api/v1/auth/providers');
    assert.deepStrictEqual(res.body.data.providers, { google: true, github: true });
  });

  test('Google start redirects with state and PKCE S256 challenge', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/google');
    const loc = new URL(res.headers.location);
    assert.strictEqual(loc.origin, 'https://accounts.google.com');
    assert.strictEqual(loc.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(loc.searchParams.get('state').length >= 40);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);
  });

  test('Unknown provider is rejected', async () => {
    const res = await request(app).get('/api/v1/auth/oauth/facebook');
    assert.strictEqual(res.status, 400);
  });

  test('Google sign-in creates a user, sets a session cookie and redirects to the safe path', async () => {
    const id = Date.now();
    fakeProfile = { google: { sub: `g-${id}`, email: `google_${id}@test.com`, email_verified: true, name: 'Gina Google', picture: 'https://lh3.googleusercontent.com/a/x' } };
    const { callback } = await runFlow('google', '/submit');
    assert.strictEqual(callback.status, 302);
    assert.strictEqual(callback.headers.location, 'http://localhost:5173/submit');
    const session = cookieValue(callback.headers['set-cookie'], 'ideapulse_token');
    assert.ok(session);

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', session);
    assert.strictEqual(me.body.data.user.email, `google_${id}@test.com`);
    assert.strictEqual(me.body.data.user.name, 'Gina Google');

    // Second sign-in reuses the same account
    const again = await runFlow('google');
    const me2 = await request(app).get('/api/v1/auth/me').set('Cookie', cookieValue(again.callback.headers['set-cookie'], 'ideapulse_token'));
    assert.strictEqual(me2.body.data.user.id, me.body.data.user.id);
  });

  test('OAuth-only accounts cannot be logged into with a password', async () => {
    const id = Date.now();
    fakeProfile = { google: { sub: `g2-${id}`, email: `nopass_${id}@test.com`, email_verified: true, name: 'No Pass' } };
    await runFlow('google');
    const res = await request(app).post('/api/v1/auth/login').send({ email: `nopass_${id}@test.com`, password: '!oauth' });
    assert.strictEqual(res.status, 401);
  });

  test('Open redirects are neutralised', async () => {
    const id = Date.now();
    fakeProfile = { google: { sub: `g3-${id}`, email: `redir_${id}@test.com`, email_verified: true, name: 'Redirect Test' } };
    for (const evil of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      const { callback } = await runFlow('google', evil);
      assert.strictEqual(callback.headers.location, 'http://localhost:5173/feed', evil);
    }
  });

  test('Callback with a forged or missing state is rejected', async () => {
    const { stateCookie } = await (async () => {
      const start = await request(app).get('/api/v1/auth/oauth/google');
      return { stateCookie: cookieValue(start.headers['set-cookie'], 'ideapulse_oauth') };
    })();

    const forged = await request(app).get('/api/v1/auth/oauth/google/callback?code=abc&state=attacker').set('Cookie', stateCookie);
    assert.strictEqual(forged.headers.location, 'http://localhost:5173/login?error=oauth_state');
    assert.strictEqual(cookieValue(forged.headers['set-cookie'], 'ideapulse_token'), null);

    const noCookie = await request(app).get('/api/v1/auth/oauth/google/callback?code=abc&state=whatever');
    assert.strictEqual(noCookie.headers.location, 'http://localhost:5173/login?error=oauth_state');
  });

  test('Unverified provider emails are refused', async () => {
    const id = Date.now();
    fakeProfile = { google: { sub: `g4-${id}`, email: `unverified_${id}@test.com`, email_verified: false, name: 'Unverified' } };
    const { callback } = await runFlow('google');
    assert.strictEqual(callback.headers.location, 'http://localhost:5173/login?error=oauth_email_unverified');
  });

  test('GitHub sign-in uses the primary verified email', async () => {
    const id = Date.now();
    fakeProfile = {
      github: { id, login: `octo${id}`, name: null, avatar_url: 'https://avatars.githubusercontent.com/u/1' },
      githubEmails: [
        { email: `unverified_${id}@test.com`, primary: false, verified: false },
        { email: `octo_${id}@test.com`, primary: true, verified: true }
      ]
    };
    const { callback } = await runFlow('github');
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookieValue(callback.headers['set-cookie'], 'ideapulse_token'));
    assert.strictEqual(me.body.data.user.email, `octo_${id}@test.com`);
    assert.strictEqual(me.body.data.user.name, `octo${id}`);
  });

  test('Linking to a pre-registered password account disables the password and revokes old sessions', async () => {
    // An attacker pre-registers the victim's email with a password they know...
    const id = Date.now();
    const email = `victim_${id}@test.com`;
    const pre = await request(app).post('/api/v1/auth/register').send({ name: 'Squatter', email, password: 'AttackerPass1' });
    const attackerSession = cookieValue(pre.headers['set-cookie'], 'ideapulse_token');

    // ...then the real owner signs in with Google.
    fakeProfile = { google: { sub: `g5-${id}`, email, email_verified: true, name: 'Real Owner' } };
    const { callback } = await runFlow('google');
    assert.ok(cookieValue(callback.headers['set-cookie'], 'ideapulse_token'));

    const attackerMe = await request(app).get('/api/v1/auth/me').set('Cookie', attackerSession);
    assert.strictEqual(attackerMe.body.data.user, null);
    const attackerLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'AttackerPass1' });
    assert.strictEqual(attackerLogin.status, 401);
  });
});

describe('Demand validation signals & waitlist', () => {
  let author, voter, otherVoter, ideaId;

  before(async () => {
    await runMigrations();
    author = await registerUser('demand_author');
    voter = await registerUser('demand_voter');
    otherVoter = await registerUser('demand_voter2');
    const res = await request(app).post('/api/v1/ideas').set('Cookie', author.cookie).send({
      title: 'Demand Target Idea',
      pitch: 'An idea used to test demand validation signals',
      description: 'Long enough description to satisfy the idea validation rules for creation.',
      category: 'Business'
    });
    ideaId = res.body.data.idea.id;
  });

  after(async () => {
    if (ideaId) await db.prepare('DELETE FROM ideas WHERE id = ?').run(ideaId);
  });

  test('Empty idea returns zeroed demand summary', async () => {
    const res = await request(app).get(`/api/v1/ideas/${ideaId}/demand`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.demand.total, 0);
    assert.strictEqual(res.body.data.demand.demand_score, 0);
    assert.strictEqual(res.body.data.my_signal, null);
  });

  test('Requires auth, rejects self-signal and invalid intent', async () => {
    assert.strictEqual((await request(app).put(`/api/v1/ideas/${ideaId}/demand`).send({ intent: 'maybe' })).status, 401);
    const self = await request(app).put(`/api/v1/ideas/${ideaId}/demand`).set('Cookie', author.cookie).send({ intent: 'would_pay' });
    assert.strictEqual(self.status, 400);
    const bad = await request(app).put(`/api/v1/ideas/${ideaId}/demand`).set('Cookie', voter.cookie).send({ intent: 'love_it' });
    assert.strictEqual(bad.status, 400);
  });

  test('Signals upsert, compute score, and sanitize price/waitlist by intent', async () => {
    let res = await request(app).put(`/api/v1/ideas/${ideaId}/demand`).set('Cookie', voter.cookie)
      .send({ intent: 'would_pay', price_tier: '10_to_30', join_waitlist: true });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.demand.demand_score, 100);
    assert.strictEqual(res.body.data.my_signal.join_waitlist, true);

    res = await request(app).put(`/api/v1/ideas/${ideaId}/demand`).set('Cookie', otherVoter.cookie)
      .send({ intent: 'pass', price_tier: 'over_100', join_waitlist: true });
    assert.strictEqual(res.body.data.my_signal.price_tier, null);
    assert.strictEqual(res.body.data.my_signal.join_waitlist, false);

    const demand = res.body.data.demand;
    assert.strictEqual(demand.total, 2);
    assert.strictEqual(demand.pay_rate, 50);
    assert.strictEqual(demand.demand_score, 50);
    assert.strictEqual(demand.price_tiers['10_to_30'], 1);
    assert.strictEqual(demand.price_tiers.over_100, 0);
    assert.strictEqual(demand.waitlist_count, 1);

    // Changing a vote updates rather than duplicates
    res = await request(app).put(`/api/v1/ideas/${ideaId}/demand`).set('Cookie', otherVoter.cookie).send({ intent: 'maybe' });
    assert.strictEqual(res.body.data.demand.total, 2);
    assert.strictEqual(res.body.data.demand.demand_score, 70);
  });

  test('Only the creator can read the waitlist, and only consenting users appear', async () => {
    assert.strictEqual((await request(app).get(`/api/v1/ideas/${ideaId}/demand/waitlist`).set('Cookie', voter.cookie)).status, 403);
    const res = await request(app).get(`/api/v1/ideas/${ideaId}/demand/waitlist`).set('Cookie', author.cookie);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.waitlist.length, 1);
    assert.strictEqual(res.body.data.waitlist[0].email, voter.user.email);
  });

  test('Removing a signal updates the summary', async () => {
    const res = await request(app).delete(`/api/v1/ideas/${ideaId}/demand`).set('Cookie', voter.cookie);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.demand.total, 1);
    assert.strictEqual((await request(app).delete(`/api/v1/ideas/${ideaId}/demand`).set('Cookie', voter.cookie)).status, 404);
  });
});
