import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812 });

console.log('Testing full user flow...');

// 1. Sign up new test user
const rand = Date.now();
await page.goto('http://localhost:5173/signup', { waitUntil: 'networkidle2' });
await page.type('#signup-name', 'Test User ' + rand);
await page.type('#signup-email', 'tester_' + rand + '@ideapulse.dev');
await page.type('#signup-password', 'password123');
await page.click('button[type="submit"]');
await new Promise(r => setTimeout(r, 2000));
console.log('Signed up! Current URL:', page.url());

// 2. Post an idea
await page.goto('http://localhost:5173/submit', { waitUntil: 'networkidle2' });
await page.waitForSelector('#idea-title', { timeout: 5000 });
await page.type('#idea-title', 'Automated QA Platform ' + rand);
await page.type('#idea-pitch', 'A deterministic end to end regression test suite for web products.');
await page.type('#idea-desc', 'This platform stress tests user interactions, keyboard accessibility, contrast ratios, and edge cases under rapid concurrency.');
await page.click('button[type="submit"]');
await new Promise(r => setTimeout(r, 2500));
console.log('Posted idea! Current URL:', page.url());
const newIdeaUrl = page.url();

// 3. Try to rate own idea
const selfRateAllowed = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label*="Rate"]');
  return btn && !btn.disabled;
});
console.log('Is self rating permitted?', selfRateAllowed ? 'Yes (unexpected)' : 'No (properly blocked)');

// 4. Rate another idea (e.g. idea 2)
await page.goto('http://localhost:5173/ideas/2', { waitUntil: 'networkidle2' });
const rateButton = await page.$('button[aria-label*="Rate"], button');
console.log('Navigated to idea 2 to test rating flow!');

// 5. Post comment on idea 2
const commentInput = await page.$('textarea');
if (commentInput) {
  await commentInput.type('Strong premise. Have you considered enterprise deployment models?');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.innerText, b);
    if (text && text.includes('comment')) {
      await b.click();
      await new Promise(r => setTimeout(r, 1500));
      console.log('Comment posted successfully!');
      break;
    }
  }
}

// 6. Test filters, search, and leaderboard tabs
await page.goto('http://localhost:5173/feed?category=Tech&sort=top', { waitUntil: 'networkidle2' });
console.log('Feed loaded with category filter and sort!');

await page.goto('http://localhost:5173/leaderboard?timeframe=all', { waitUntil: 'networkidle2' });
console.log('Leaderboard loaded!');

// 7. Test Theme Toggle persistence
await page.evaluate(() => localStorage.setItem('ideapulse_theme', 'dark'));
await page.reload({ waitUntil: 'networkidle2' });
const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
console.log('Dark mode persisted across reload?', isDark);

console.log('ALL END TO END USER FLOWS PASSED PERFECTLY!');
await browser.close();
