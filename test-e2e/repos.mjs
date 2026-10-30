// E2E: sharing, upvoting, searching and removing GitHub repos on /repos.
// Calls the real GitHub API, so it needs network access. API on :5001 and Vite on :5173
// (or set BASE to a single-origin server, e.g. BASE=http://localhost:5099).
// Usage: node test-e2e/repos.mjs [screenshotDir]
import puppeteer from 'puppeteer-core';
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:5173';
const shots = process.argv[2] || '.';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});
const errors = [];
async function newPage(theme = 'light', viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument((t) => localStorage.setItem('ideapulse_theme', t), theme);
  // Keep test traffic out of the real Google Analytics property. Answering with an empty response
  // (rather than aborting) avoids "Failed to load resource" console errors.
  await page.setRequestInterception(true);
  page.on('request', (r) => (/google-analytics\.com|googletagmanager\.com/.test(r.url())
    ? r.respond({ status: 204, body: '' })
    : r.continue()));
  page.on('pageerror', (e) => errors.push(e.message));
  // 401 = logged-out /auth/me; 400/409 = the invalid and duplicate shares this test makes on purpose.
  page.on('console', (m) => m.type() === 'error' && !/\b(401|400|409)\b/.test(m.text()) && errors.push(m.text()));
  return page;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const textIncludes = (page, text, timeout = 10000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
// Triple-click doesn't reliably select input text in headless Chrome; select it and delete instead.
async function clearInput(page, selector) {
  await page.$eval(selector, (el) => { el.focus(); el.select(); });
  await page.keyboard.press('Backspace');
}
const repoRow = (page, fullName) =>
  page.evaluateHandle((n) => [...document.querySelectorAll('article')].find((a) => a.querySelector('h2')?.innerText.trim() === n), fullName);

const stamp = Date.now();
const REPO = 'sindresorhus/awesome';

// 1. Logged-out visitors can browse but are asked to sign in to share
{
  const page = await newPage();
  await page.goto(BASE + '/repos', { waitUntil: 'networkidle2' });
  await textIncludes(page, 'GitHub Repos');
  await textIncludes(page, 'Sign in to share');
  assert.strictEqual(await page.$('#repo-url'), null, 'share form hidden when logged out');
  console.log('✔ Logged-out visitors see the list and a sign-in prompt');
}

// 2. A signed-in user shares, upvotes, searches and removes a repo
{
  const page = await newPage();
  await page.goto(BASE + '/repos', { waitUntil: 'networkidle2' });
  const reg = await page.evaluate(async (s) => {
    const r = await fetch('/api/v1/auth/register', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Repo Sharer', email: `e2e_repos_${s}@example.com`, password: 'Password123!' })
    });
    return r.status;
  }, stamp);
  assert.strictEqual(reg, 201);
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('#repo-url');

  // Clean slate if a previous run left the repo behind
  const leftover = await repoRow(page, REPO);
  if (await leftover.evaluate((el) => !!el)) {
    console.log(`  (note: ${REPO} already shared by someone else; using it as the duplicate case only)`);
  }

  await page.click('section[aria-labelledby="share-repo-heading"] button[type="submit"]');
  await page.waitForSelector('[role="alert"]');
  console.log('✔ Empty link is rejected in the UI');

  await page.type('#repo-url', 'https://gitlab.com/gitlab-org/gitlab');
  await page.click('section[aria-labelledby="share-repo-heading"] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('[role="alert"]')?.innerText.includes('Enter a GitHub repository link'), { timeout: 8000 });
  console.log('✔ Non-GitHub link shows a readable error');

  await clearInput(page, '#repo-url');
  await page.type('#repo-url', `https://github.com/${REPO}`);
  await page.type('#repo-note', 'Saw this in a video, great starting point');
  await page.click('section[aria-labelledby="share-repo-heading"] button[type="submit"]');

  const sharedNow = await page.waitForFunction(
    (n) => document.body.innerText.includes(`Shared ${n}`) || document.querySelector('[role="alert"]')?.innerText.includes('already been shared'),
    { timeout: 15000 }, REPO
  ).then(() => page.evaluate(() => !document.querySelector('[role="alert"]')));

  if (sharedNow) {
    await textIncludes(page, 'Saw this in a video, great starting point');
    assert.strictEqual(await page.$eval('#repo-url', (el) => el.value), '', 'form clears after sharing');
    console.log('✔ Sharing a real repo pulls details from GitHub and shows it in the list');

    // Sharing the same repo again is blocked
    await page.type('#repo-url', REPO);
    await page.click('section[aria-labelledby="share-repo-heading"] button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('[role="alert"]')?.innerText.includes('already been shared'), { timeout: 15000 });
    console.log('✔ Sharing the same repo twice shows "already been shared"');
    await clearInput(page, '#repo-url');
  }

  // Upvote toggles on and off
  const row = await repoRow(page, REPO);
  const voteBtn = await row.asElement().$('button[aria-pressed]');
  const count = () => voteBtn.evaluate((b) => Number(b.innerText.trim()));
  const before = await count();
  const wasPressed = await voteBtn.evaluate((b) => b.getAttribute('aria-pressed') === 'true');
  await voteBtn.click();
  await page.waitForFunction((b, p) => b.getAttribute('aria-pressed') === String(!p), { timeout: 8000 }, voteBtn, wasPressed);
  await wait(300);
  assert.strictEqual(await count(), before + (wasPressed ? -1 : 1));
  await voteBtn.click();
  await page.waitForFunction((b, p) => b.getAttribute('aria-pressed') === String(p), { timeout: 8000 }, voteBtn, wasPressed);
  await wait(300);
  assert.strictEqual(await count(), before);
  console.log('✔ Upvote toggles on and off with the right count');

  // Vote survives a reload
  await voteBtn.click();
  await wait(800);
  await page.reload({ waitUntil: 'networkidle2' });
  const reloaded = await (await repoRow(page, REPO)).asElement().$eval('button[aria-pressed]', (b) => b.getAttribute('aria-pressed'));
  assert.strictEqual(reloaded, String(!wasPressed));
  console.log('✔ Upvote is saved after reload');

  // Search and sort
  await page.type('#repo-search-input', 'awesome-list');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.search.includes('search=awesome-list'));
  await textIncludes(page, REPO);
  await clearInput(page, '#repo-search-input');
  await page.type('#repo-search-input', `zz-nothing-${stamp}`);
  await page.keyboard.press('Enter');
  await textIncludes(page, 'No repos found');
  await page.click('button[aria-label="Clear search query"]');
  await textIncludes(page, REPO);
  console.log('✔ Search by topic finds the repo; no-match shows the empty state');

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Newest').click());
  await page.waitForFunction(() => location.search.includes('sort=newest'));
  console.log('✔ Newest sort updates the URL');

  await page.screenshot({ path: `${shots}/repos-light.png`, fullPage: true });

  if (sharedNow) {
    const mine = (await repoRow(page, REPO)).asElement();
    const removeBtn = await mine.$$eval('button', (bs) => bs.findIndex((b) => b.innerText.includes('Remove')));
    assert.ok(removeBtn >= 0, 'sharer sees a Remove button');
    await (await mine.$$('button'))[removeBtn].click();
    await page.waitForFunction((n) => ![...document.querySelectorAll('article h2')].some((h) => h.innerText.trim() === n), { timeout: 8000 }, REPO);
    console.log('✔ Sharer can remove their repo');
  }
}

// 3. Dark mode and mobile layout
{
  const dark = await newPage('dark');
  await dark.goto(BASE + '/repos', { waitUntil: 'networkidle2' });
  await textIncludes(dark, 'GitHub Repos');
  await dark.screenshot({ path: `${shots}/repos-dark.png`, fullPage: true });

  const mobile = await newPage('light', { width: 375, height: 812 });
  await mobile.goto(BASE + '/repos', { waitUntil: 'networkidle2' });
  await textIncludes(mobile, 'GitHub Repos');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `no horizontal scroll on mobile (${overflow}px)`);
  await mobile.screenshot({ path: `${shots}/repos-mobile.png`, fullPage: true });
  console.log('✔ Dark mode renders; mobile layout has no horizontal overflow');
}

await browser.close();
assert.deepStrictEqual(errors, [], `page errors: ${errors.join(' | ')}`);
console.log('✔ No page errors');
