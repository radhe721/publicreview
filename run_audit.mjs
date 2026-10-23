import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = '/Users/radhe/.gemini/antigravity-ide/brain/518acabb-90b7-43cd-bd52-feab16349f2c/screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  // Set theme helper
  async function setTheme(page, mode) {
    await page.evaluate((m) => {
      localStorage.setItem('ideapulse_theme', m);
      if (m === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }, mode);
    await new Promise(r => setTimeout(r, 200));
  }

  // Audit helper with axe
  const axeSource = fs.readFileSync(path.resolve('./node_modules/axe-core/axe.min.js'), 'utf8');

  const publicPages = [
    { name: 'landing', url: 'http://localhost:5173/' },
    { name: 'feed', url: 'http://localhost:5173/feed' },
    { name: 'idea_detail', url: 'http://localhost:5173/ideas/1' },
    { name: 'leaderboard', url: 'http://localhost:5173/leaderboard' },
    { name: 'login', url: 'http://localhost:5173/login' },
    { name: 'signup', url: 'http://localhost:5173/signup' },
  ];

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 360, height: 780 }
  ];

  const auditReport = {};

  // 1. Audit Public Pages in Clean Browser Context
  const publicContext = await browser.createBrowserContext();
  const page = await publicContext.newPage();

  for (const p of publicPages) {
    auditReport[p.name] = { light: {}, dark: {}, axe: {} };
    console.log(`Auditing ${p.name}...`);
    
    // Visit desktop light
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(e => console.log(`Nav error: ${e.message}`));
    await setTheme(page, 'light');
    await new Promise(r => setTimeout(r, 600));

    // Inject axe
    await page.evaluate(axeSource);
    const axeResults = await page.evaluate(async () => {
      return await window.axe.run();
    });
    auditReport[p.name].axe = {
      violationsCount: axeResults.violations.length,
      violations: axeResults.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length }))
    };

    // Screenshots for light mode
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await setTheme(page, 'light');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${p.name}_${vp.name}_light.png`, fullPage: false });
    }

    // Screenshots for dark mode
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await setTheme(page, 'dark');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${p.name}_${vp.name}_dark.png`, fullPage: false });
    }
  }

  await page.close();
  await publicContext.close();

  // 2. Audit Authenticated Pages in Dedicated Context
  console.log('Logging in to test authenticated pages...');
  const authContext = await browser.createBrowserContext();
  const authPage = await authContext.newPage();
  await authPage.setViewport({ width: 1440, height: 900 });
  await authPage.goto('http://localhost:5173/login', { waitUntil: 'networkidle2', timeout: 15000 });
  await authPage.waitForSelector('#login-email', { timeout: 8000 });
  await authPage.type('#login-email', 'admin@ideapulse.dev');
  await authPage.type('#login-password', 'password123');
  await authPage.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  const authPages = [
    { name: 'submit_idea', url: 'http://localhost:5173/submit' },
    { name: 'edit_idea', url: 'http://localhost:5173/ideas/1/edit' },
    { name: 'profile', url: 'http://localhost:5173/profile/1' },
    { name: 'admin', url: 'http://localhost:5173/admin' }
  ];

  for (const p of authPages) {
    auditReport[p.name] = { axe: {} };
    console.log(`Auditing auth page ${p.name}...`);
    await authPage.setViewport({ width: 1440, height: 900 });
    await authPage.goto(p.url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(e => console.log(`Nav error: ${e.message}`));
    await setTheme(authPage, 'light');
    await new Promise(r => setTimeout(r, 600));

    await authPage.evaluate(axeSource);
    const axeResults = await authPage.evaluate(async () => {
      return await window.axe.run();
    });
    auditReport[p.name].axe = {
      violationsCount: axeResults.violations.length,
      violations: axeResults.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length }))
    };

    for (const vp of viewports) {
      await authPage.setViewport({ width: vp.width, height: vp.height });
      await setTheme(authPage, 'light');
      await authPage.screenshot({ path: `${SCREENSHOT_DIR}/${p.name}_${vp.name}_light.png`, fullPage: false });
      await setTheme(authPage, 'dark');
      await authPage.screenshot({ path: `${SCREENSHOT_DIR}/${p.name}_${vp.name}_dark.png`, fullPage: false });
    }
  }

  // Also take a screenshot of Command Palette open!
  console.log('Capturing Command Palette screenshot...');
  await authPage.setViewport({ width: 1440, height: 900 });
  await authPage.goto('http://localhost:5173/feed', { waitUntil: 'networkidle2' });
  await setTheme(authPage, 'light');
  await authPage.keyboard.down('Meta');
  await authPage.keyboard.press('KeyK');
  await authPage.keyboard.up('Meta');
  await new Promise(r => setTimeout(r, 400));
  await authPage.screenshot({ path: `${SCREENSHOT_DIR}/command_palette_light.png`, fullPage: false });

  await setTheme(authPage, 'dark');
  await authPage.screenshot({ path: `${SCREENSHOT_DIR}/command_palette_dark.png`, fullPage: false });

  await authPage.close();
  await authContext.close();

  fs.writeFileSync(
    '/Users/radhe/.gemini/antigravity-ide/brain/518acabb-90b7-43cd-bd52-feab16349f2c/scratch/final_axe_report.json',
    JSON.stringify(auditReport, null, 2)
  );

  console.log('Audit screenshots and axe report complete!');
  await browser.close();
}

run().catch(console.error);
