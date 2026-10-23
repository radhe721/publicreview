import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = '/Users/radhe/.gemini/antigravity-ide/brain/8b2a17c4-8415-4fca-aaeb-05fd8e1ad0fd/screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const axeSource = fs.readFileSync(path.resolve('./node_modules/axe-core/axe.min.js'), 'utf8');

const pagesToTest = [
  { name: 'landing', path: '/' },
  { name: 'feed', path: '/feed' },
  { name: 'leaderboard', path: '/leaderboard' },
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
  { name: 'idea_detail', path: '/ideas/1' },
  { name: 'not_found', path: '/non-existent-page-xyz' }
];

const viewports = [
  { name: 'desktop_1440', width: 1440, height: 900 },
  { name: 'tablet_768', width: 768, height: 1024 },
  { name: 'mobile_375', width: 375, height: 812 }
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const consoleLogs = [];
  const networkErrors = [];

  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push({ type: msg.type(), text: msg.text(), location: msg.location() });
    }
  });

  page.on('response', response => {
    if (response.status() >= 400 && !response.url().includes('non-existent-page')) {
      networkErrors.push({ url: response.url(), status: response.status() });
    }
  });

  const axeResultsSummary = {};

  async function applyTheme(mode) {
    await page.evaluate((theme) => {
      localStorage.setItem('ideapulse_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }, mode);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('Testing public pages across viewports and themes...');
  for (const p of pagesToTest) {
    console.log(`Checking ${p.name} at http://localhost:5173${p.path}`);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://localhost:5173${p.path}`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(e => console.log(`Nav error: ${e.message}`));
    await applyTheme('light');
    await new Promise(r => setTimeout(r, 400));

    // Run axe in light mode
    await page.evaluate(axeSource);
    const axeLight = await page.evaluate(async () => window.axe.run());
    
    // Switch to dark mode and run axe
    await applyTheme('dark');
    const axeDark = await page.evaluate(async () => window.axe.run());

    axeResultsSummary[p.name] = {
      lightViolations: axeLight.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, count: v.nodes.length })),
      darkViolations: axeDark.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, count: v.nodes.length }))
    };

    // Screenshots
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await applyTheme('light');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${p.name}_${vp.name}_light.png`, fullPage: false });
      await applyTheme('dark');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${p.name}_${vp.name}_dark.png`, fullPage: false });
    }
  }

  // Next: Authenticated flow
  console.log('Testing authenticated flows...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-email', { timeout: 5000 });
  await page.type('#login-email', 'admin@ideapulse.dev');
  await page.type('#login-password', 'password123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  const authPages = [
    { name: 'submit_idea', path: '/submit' },
    { name: 'profile', path: '/profile/1' },
    { name: 'admin_moderation', path: '/admin' }
  ];

  for (const ap of authPages) {
    console.log(`Checking authenticated ${ap.name} at http://localhost:5173${ap.path}`);
    await page.goto(`http://localhost:5173${ap.path}`, { waitUntil: 'networkidle2' }).catch(e => console.log(`Nav error: ${e.message}`));
    await applyTheme('light');
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(axeSource);
    const axeLight = await page.evaluate(async () => window.axe.run());
    await applyTheme('dark');
    const axeDark = await page.evaluate(async () => window.axe.run());

    axeResultsSummary[ap.name] = {
      lightViolations: axeLight.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, count: v.nodes.length })),
      darkViolations: axeDark.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, count: v.nodes.length }))
    };

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await applyTheme('light');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${ap.name}_${vp.name}_light.png`, fullPage: false });
      await applyTheme('dark');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${ap.name}_${vp.name}_dark.png`, fullPage: false });
    }
  }

  fs.writeFileSync(
    `${SCREENSHOT_DIR}/axe_summary.json`,
    JSON.stringify(axeResultsSummary, null, 2)
  );

  console.log('\n--- Console Errors/Warnings ---');
  console.log(consoleLogs);
  console.log('\n--- Network Errors ---');
  console.log(networkErrors);
  console.log('\n--- Axe Violations Summary ---');
  for (const [pageName, res] of Object.entries(axeResultsSummary)) {
    const lightSerious = res.lightViolations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    const darkSerious = res.darkViolations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    console.log(`${pageName}: Light violations: ${res.lightViolations.length} (${lightSerious.length} critical/serious) | Dark violations: ${res.darkViolations.length} (${darkSerious.length} critical/serious)`);
  }

  await browser.close();
  console.log('\nExploratory sweep complete.');
}

run().catch(err => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
