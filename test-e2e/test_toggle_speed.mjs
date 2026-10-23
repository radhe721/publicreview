import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle2' });

console.log('Testing Theme Toggle Speed:');

for (let i = 0; i < 5; i++) {
  const result = await page.evaluate(async () => {
    const btn = document.querySelector('button[aria-label*="Theme"]');
    if (!btn) return { error: 'Button not found' };
    const start = performance.now();
    const initialClass = document.documentElement.className;
    
    btn.click();
    
    let afterClass = document.documentElement.className;
    const domChangeTime = performance.now() - start;
    
    const rootEl = document.querySelector('.min-h-screen');
    const rootStyle = rootEl ? window.getComputedStyle(rootEl) : null;
    
    return {
      domChangeTime,
      initialClass,
      afterClass,
      rootBg: rootStyle ? rootStyle.backgroundColor : null,
      transitionProperty: rootStyle ? rootStyle.transitionProperty : null,
      transitionDuration: rootStyle ? rootStyle.transitionDuration : null,
    };
  });
  
  console.log(`Toggle ${i + 1}: ${result.initialClass} -> ${result.afterClass} in ${result.domChangeTime.toFixed(2)}ms`);
  console.log(`  Root transitions: ${result.transitionProperty} (${result.transitionDuration}), BG: ${result.rootBg}`);
  await new Promise(r => setTimeout(r, 200));
}

await browser.close();
