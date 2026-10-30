import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { runMigrations } from '../src/db/migrate.js';
import { parseGithubRepo } from '../src/services/github.js';

describe('Shared GitHub repos', () => {
  const stamp = Date.now();
  const githubId = stamp; // unique per run so reruns against the same test DB don't collide
  const realFetch = globalThis.fetch;
  let aliceCookie, bobCookie, repoId;

  // Fake GitHub API: "acme/tool" exists, "acme/secret" is private, everything else is a 404.
  before(async () => {
    globalThis.fetch = async (url) => {
      const path = new URL(url).pathname;
      if (path === '/repos/acme/tool') {
        return new Response(JSON.stringify({
          id: githubId,
          full_name: 'acme/tool',
          private: false,
          owner: { avatar_url: 'https://avatars.githubusercontent.com/u/1' },
          description: 'A handy tool',
          language: 'TypeScript',
          stargazers_count: 1234,
          forks_count: 56,
          topics: ['cli', 'devtools']
        }), { status: 200 });
      }
      if (path === '/repos/acme/secret') {
        return new Response(JSON.stringify({ id: githubId + 1, full_name: 'acme/secret', private: true }), { status: 200 });
      }
      return new Response('{"message":"Not Found"}', { status: 404 });
    };

    await runMigrations();
    const signup = async (who) => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: `Repo ${who}`, email: `repo_${who}_${stamp}@test.com`, password: 'Password123!'
      });
      return res.headers['set-cookie'].find((c) => c.startsWith('ideapulse_token=')).split(';')[0];
    };
    aliceCookie = await signup('alice');
    bobCookie = await signup('bob');
  });

  after(() => {
    globalThis.fetch = realFetch;
  });

  test('parseGithubRepo accepts common link shapes and rejects others', () => {
    assert.deepStrictEqual(parseGithubRepo('https://github.com/acme/tool'), { owner: 'acme', name: 'tool' });
    assert.deepStrictEqual(parseGithubRepo('github.com/acme/tool/tree/main/src'), { owner: 'acme', name: 'tool' });
    assert.deepStrictEqual(parseGithubRepo('https://github.com/acme/tool.git'), { owner: 'acme', name: 'tool' });
    assert.deepStrictEqual(parseGithubRepo('acme/tool'), { owner: 'acme', name: 'tool' });
    assert.strictEqual(parseGithubRepo('https://gitlab.com/acme/tool'), null);
    assert.strictEqual(parseGithubRepo('https://github.com/acme'), null);
    assert.strictEqual(parseGithubRepo('evil.com/tool'), null);
    assert.strictEqual(parseGithubRepo(''), null);
  });

  test('Sharing requires sign-in and a GitHub link', async () => {
    assert.strictEqual((await request(app).post('/api/v1/repos').send({ url: 'acme/tool' })).status, 401);
    const res = await request(app).post('/api/v1/repos').set('Cookie', aliceCookie).send({ url: 'https://example.com/x' });
    assert.strictEqual(res.status, 400);
  });

  test('Shares a repo with details from GitHub', async () => {
    const res = await request(app).post('/api/v1/repos').set('Cookie', aliceCookie)
      .send({ url: 'https://github.com/acme/tool', note: 'Saw this in a video, saves me hours' });
    assert.strictEqual(res.status, 201);
    const repo = res.body.data.repo;
    repoId = repo.id;
    assert.strictEqual(repo.full_name, 'acme/tool');
    assert.strictEqual(repo.html_url, 'https://github.com/acme/tool');
    assert.strictEqual(repo.stars, 1234);
    assert.deepStrictEqual(repo.topics, ['cli', 'devtools']);
    assert.strictEqual(repo.note, 'Saw this in a video, saves me hours');
    assert.strictEqual(repo.upvotes, 0);
  });

  test('The same repo cannot be shared twice', async () => {
    const res = await request(app).post('/api/v1/repos').set('Cookie', bobCookie).send({ url: 'acme/tool' });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.data.id, repoId);
  });

  test('Missing and private repos are rejected', async () => {
    assert.strictEqual((await request(app).post('/api/v1/repos').set('Cookie', bobCookie).send({ url: 'acme/nope' })).status, 404);
    assert.strictEqual((await request(app).post('/api/v1/repos').set('Cookie', bobCookie).send({ url: 'acme/secret' })).status, 404);
  });

  test('Upvoting is idempotent and can be undone', async () => {
    let res = await request(app).post(`/api/v1/repos/${repoId}/upvote`).set('Cookie', bobCookie);
    assert.strictEqual(res.body.data.repo.upvotes, 1);
    assert.strictEqual(res.body.data.repo.has_upvoted, true);
    res = await request(app).post(`/api/v1/repos/${repoId}/upvote`).set('Cookie', bobCookie);
    assert.strictEqual(res.body.data.repo.upvotes, 1);
    res = await request(app).delete(`/api/v1/repos/${repoId}/upvote`).set('Cookie', bobCookie);
    assert.strictEqual(res.body.data.repo.upvotes, 0);
    assert.strictEqual(res.body.data.repo.has_upvoted, false);
  });

  test('Anyone can browse and search; has_upvoted reflects the viewer', async () => {
    await request(app).post(`/api/v1/repos/${repoId}/upvote`).set('Cookie', bobCookie);

    const anon = await request(app).get('/api/v1/repos?search=devtools');
    assert.strictEqual(anon.status, 200);
    const found = anon.body.data.repos.find((r) => r.id === repoId);
    assert.ok(found);
    assert.strictEqual(found.has_upvoted, false);

    const asBob = await request(app).get('/api/v1/repos?sort=newest').set('Cookie', bobCookie);
    assert.strictEqual(asBob.body.data.repos.find((r) => r.id === repoId).has_upvoted, true);

    assert.strictEqual((await request(app).get('/api/v1/repos?sort=weird')).status, 400);
  });

  test('Only the sharer can remove a repo', async () => {
    assert.strictEqual((await request(app).delete(`/api/v1/repos/${repoId}`).set('Cookie', bobCookie)).status, 403);
    assert.strictEqual((await request(app).delete(`/api/v1/repos/${repoId}`).set('Cookie', aliceCookie)).status, 200);
    assert.strictEqual((await request(app).post(`/api/v1/repos/${repoId}/upvote`).set('Cookie', bobCookie)).status, 404);
  });
});
