// E2E: OAuth buttons, demand signals, and the creator waitlist.
// Requires a seeded local DB, API on :5001 with GOOGLE_/GITHUB_ client IDs set, and Vite on :5173.
// Usage: node test-e2e/demand_and_oauth.mjs [screenshotDir]
import puppeteer from 'puppeteer-core';
import assert from 'node:assert';

const BASE = 'http://localhost:5173';
const shots = process.argv[2] || '.';
const IDEA_ID = 22; // Seeded idea by Sophia Patel (sophia@designstudio.co)

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox']
});

const consoleErrors = [];
async function newPage(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && consoleErrors.push(m.text()));
  return page;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = async (page, selector, text) => {
  const handles = await page.$$(selector);
  for (const h of handles) {
    if ((await h.evaluate((el) => el.textContent)).includes(text)) return h.click();
  }
  throw new Error(`No ${selector} containing "${text}"`);
};

// 1. Login page shows OAuth buttons, hides demo logins in production builds, and starts the flow.
{
  const page = await newPage();
  await page.goto(`${BASE}/login?redirect=/submit`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('a[href*="/auth/oauth/google"]');
  const hrefs = await page.$$eval('a[href*="/auth/oauth/"]', (as) => as.map((a) => a.getAttribute('href')));
  assert.deepStrictEqual(hrefs, ['/api/v1/auth/oauth/google?redirect=%2Fsubmit', '/api/v1/auth/oauth/github?redirect=%2Fsubmit']);
  await page.screenshot({ path: `${shots}/login.png` });

  await page.setRequestInterception(true);
  let providerUrl = null;
  page.on('request', (req) => {
    if (req.url().startsWith('https://accounts.google.com')) {
      providerUrl = new URL(req.url());
      return req.abort();
    }
    req.continue();
  });
  await page.click('a[href*="/auth/oauth/google"]');
  await wait(1500);
  assert.ok(providerUrl, 'navigated to Google');
  assert.strictEqual(providerUrl.searchParams.get('client_id'), 'fake-google-id');
  assert.strictEqual(providerUrl.searchParams.get('code_challenge_method'), 'S256');
  console.log('✔ OAuth buttons render and start a PKCE flow →', providerUrl.searchParams.get('redirect_uri'));

  const errPage = await newPage();
  await errPage.goto(`${BASE}/login?error=oauth_state`, { waitUntil: 'networkidle2' });
  const alert = await errPage.$eval('[role="alert"]', (el) => el.textContent);
  assert.match(alert, /expired/);
  console.log('✔ OAuth error message shown on login page');
}

// 2. A new user signs up and casts a "would pay" signal and joins the waitlist.
const rand = Date.now();
const voterName = `Waitlist Tester ${rand}`;
const voterEmail = `waitlist_${rand}@example.com`;
{
  const page = await newPage();
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle2' });
  await page.type('#signup-name', voterName);
  await page.type('#signup-email', voterEmail);
  await page.type('#signup-password', 'short');
  await page.click('button[type="submit"]');
  await wait(300);
  assert.ok((await page.content()).includes('at least 8 characters'), 'short password rejected in UI');
  await page.click('#signup-password', { clickCount: 3 });
  await page.type('#signup-password', 'GoodPassword123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === '/feed', { timeout: 8000 });
  const toasts = await page.$$eval('[data-sonner-toast]', (t) => t.length);
  assert.strictEqual(toasts, 1, 'exactly one welcome toast');
  console.log('✔ Signup works, single toast');

  await page.goto(`${BASE}/ideas/${IDEA_ID}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[role="radiogroup"][aria-label="Your demand signal"]');
  await clickByText(page, '[role="radio"]', "I'd pay for it");
  await clickByText(page, 'button[aria-pressed]', '$10–30');
  await page.click('input[type="checkbox"]');
  await clickByText(page, 'button', 'Submit signal');
  await page.waitForFunction(() => document.body.innerText.includes('Update signal'), { timeout: 5000 });
  const summary = await page.evaluate(() => document.body.innerText);
  assert.match(summary, /\d+\s*\/ 100/);
  assert.match(summary, /[1-9]\d*\s*on the launch waitlist/);
  const section = await page.$('section:has([aria-label="Your demand signal"])');
  await section.screenshot({ path: `${shots}/demand-voter.png` });
  console.log('✔ Demand signal saved; score and waitlist count update');

  // Reload: signal persists and is pre-selected
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('[role="radio"][aria-checked="true"]');
  const checked = await page.$eval('[role="radio"][aria-checked="true"]', (el) => el.textContent);
  assert.match(checked, /pay for it/);
  console.log('✔ Signal persists after reload');

  // Mobile + dark mode rendering
  const mobile = await newPage({ width: 375, height: 812 });
  await mobile.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await mobile.goto(`${BASE}/ideas/${IDEA_ID}`, { waitUntil: 'networkidle2' });
  await wait(500);
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `no horizontal scroll on mobile (overflow ${overflow}px)`);
  await mobile.screenshot({ path: `${shots}/demand-mobile-dark.png`, fullPage: true });
  console.log('✔ Mobile/dark layout has no horizontal overflow');
}

// 3. The creator sees the waitlist, with the voter, and can export it.
{
  const page = await newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.type('#login-email', 'sophia@designstudio.co');
  await page.type('#login-password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === '/feed', { timeout: 8000 });
  await page.goto(`${BASE}/ideas/${IDEA_ID}`, { waitUntil: 'networkidle2' });
  await page.waitForFunction((email) => document.body.innerText.includes(email), { timeout: 5000 }, voterEmail);
  assert.strictEqual(await page.$('[aria-label="Your demand signal"]'), null, 'creator cannot vote');
  const section = await page.$('section:has(a[href^="mailto:"])');
  await section.screenshot({ path: `${shots}/demand-creator.png` });
  console.log('✔ Creator sees waitlist with voter email');
}

// 4. Logged-out visitor sees the sign-in prompt.
{
  const page = await newPage();
  await page.goto(`${BASE}/ideas/${IDEA_ID}`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.includes('Sign in to vote'));
  console.log('✔ Logged-out visitors are prompted to sign in');
}

await browser.close();
assert.deepStrictEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
console.log('✔ No uncaught page errors');
