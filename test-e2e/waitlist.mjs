// E2E: landing-page waitlist signup and the admin waitlist dashboard.
// Requires a seeded local DB (demo admin), API on :5001 and Vite on :5173.
// Usage: node test-e2e/waitlist.mjs [screenshotDir]
import puppeteer from 'puppeteer-core';
import assert from 'node:assert';

const BASE = 'http://localhost:5173';
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
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && errors.push(m.text()));
  return page;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const email = `e2e_waitlist_${Date.now()}@example.com`;

// 1. Visitor joins from the landing page
{
  const page = await newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#waitlist-email');
  await (await page.$('section[aria-labelledby="waitlist-heading"]')).screenshot({ path: `${shots}/waitlist-card.png` });

  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="alert"]');
  console.log('✔ Empty email is rejected in the UI');

  await page.type('#waitlist-email', email);
  await page.type('#waitlist-name', 'E2E Tester');
  await page.type('#waitlist-use', 'Checking the waitlist works');
  await page.click('section[aria-labelledby="waitlist-heading"] button[type="submit"]');
  await page.waitForFunction(() => document.body.innerText.includes("You're on the list!"), { timeout: 8000 });
  console.log('✔ Signup succeeds and shows confirmation');

  const mobile = await newPage('dark', { width: 375, height: 812 });
  await mobile.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await mobile.waitForSelector('#waitlist-email');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `no horizontal scroll on mobile (${overflow}px)`);
  console.log('✔ Mobile layout has no horizontal overflow');
}

// 2. Admin sees the signup in the dashboard (light + dark), chart tooltip works, CSV downloads
for (const theme of ['light', 'dark']) {
  const page = await newPage(theme);
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  await page.type('#login-email', 'admin@ideapulse.dev');
  await page.type('#login-password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === '/feed', { timeout: 8000 });
  await page.goto(BASE + '/admin/waitlist', { waitUntil: 'networkidle2' });
  await page.waitForFunction((e) => document.body.innerText.includes(e), { timeout: 8000 }, email);

  const bars = await page.$$('button[aria-label*="signup"]');
  assert.strictEqual(bars.length, 30, '30 day columns');
  await bars[bars.length - 2].hover();
  await page.waitForSelector('[role="status"]');
  await page.screenshot({ path: `${shots}/admin-waitlist-${theme}.png`, fullPage: false });
  console.log(`✔ Admin dashboard (${theme}) lists the signup; chart tooltip shows`);

  if (theme === 'light') {
    const csv = await page.evaluate(async () => {
      const r = await fetch('/api/v1/waitlist/export.csv', { credentials: 'include' });
      return { status: r.status, type: r.headers.get('content-type'), text: await r.text() };
    });
    assert.strictEqual(csv.status, 200);
    assert.ok(csv.text.includes(email), 'CSV contains the new signup');
    console.log('✔ CSV export contains the signup');
  }
}

// 3. Non-admins are bounced away from the dashboard
{
  const page = await newPage();
  await page.goto(BASE + '/admin/waitlist', { waitUntil: 'networkidle2' });
  await wait(500);
  assert.notStrictEqual(new URL(page.url()).pathname, '/admin/waitlist');
  console.log('✔ Logged-out visitors cannot open the admin dashboard');
}

await browser.close();
assert.deepStrictEqual(errors, [], `page errors: ${errors.join(' | ')}`);
console.log('✔ No page errors');
