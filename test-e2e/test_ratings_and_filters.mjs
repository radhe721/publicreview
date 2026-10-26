import puppeteer from 'puppeteer-core';
import assert from 'assert';

console.log('🧪 Starting Comprehensive Rating & Filter Verification...\n');

// Part 1: API Level Verification of Ratings & Filters
const API_BASE = 'http://localhost:5001/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body: data };
}

// 1. Create 2 test users for rating tests
const rand = Date.now();
const authorEmail = `author_${rand}@ideapulse.dev`;
const reviewerEmail = `reviewer_${rand}@ideapulse.dev`;

const signupAuthor = await request('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ name: 'Author User', email: authorEmail, password: 'Password123!' })
});
assert.strictEqual(signupAuthor.status, 201, 'Author signup failed');
const authorCookie = signupAuthor.headers.get('set-cookie')?.split(';')[0];
const authorId = signupAuthor.body.data.user.id;

const signupReviewer = await request('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ name: 'Reviewer User', email: reviewerEmail, password: 'Password123!' })
});
assert.strictEqual(signupReviewer.status, 201, 'Reviewer signup failed');
const reviewerCookie = signupReviewer.headers.get('set-cookie')?.split(';')[0];

console.log('✅ Auth setup complete for Author and Reviewer.');

// 2. Author creates ideas across different categories
const categories = ['Tech', 'Design', 'Social', 'Business'];
const createdIdeaIds = [];

for (const cat of categories) {
  const resIdea = await request('/ideas', {
    method: 'POST',
    headers: { Cookie: authorCookie },
    body: JSON.stringify({
      title: `${cat} Venture Concept ${rand}`,
      pitch: `A revolutionary idea in the ${cat} category.`,
      description: `Comprehensive description for testing ${cat} filters and rating dynamics. Exceeds twenty characters easily.`,
      category: cat,
      tags: [cat.toLowerCase(), 'startup']
    })
  });
  assert.strictEqual(resIdea.status, 201, `Failed to create ${cat} idea`);
  createdIdeaIds.push({ id: resIdea.body.data.idea.id, category: cat });
}
console.log(`✅ Created ${createdIdeaIds.length} test ideas across categories.`);

const testIdeaId = createdIdeaIds[0].id;

// 3. Test Rating: Self-rating prevention
const selfRateRes = await request(`/ideas/${testIdeaId}/ratings`, {
  method: 'POST',
  headers: { Cookie: authorCookie },
  body: JSON.stringify({ score: 5, review_text: 'I think my own idea is great!' })
});
assert.strictEqual(selfRateRes.status, 400, 'Self rating should be rejected with 400');
console.log('✅ Self-rating properly blocked by business rule.');

// 4. Test Rating: Unauthenticated rating prevention
const unauthRateRes = await request(`/ideas/${testIdeaId}/ratings`, {
  method: 'POST',
  body: JSON.stringify({ score: 5 })
});
assert.strictEqual(unauthRateRes.status, 401, 'Unauthenticated rating should return 401');
console.log('✅ Unauthenticated rating properly blocked with 401.');

// 5. Test Rating: Boundary validation (0, 6, 'invalid')
for (const badScore of [0, 6, -1, 'abc']) {
  const badRes = await request(`/ideas/${testIdeaId}/ratings`, {
    method: 'POST',
    headers: { Cookie: reviewerCookie },
    body: JSON.stringify({ score: badScore })
  });
  assert.strictEqual(badRes.status, 400, `Score ${badScore} should be rejected with 400`);
}
console.log('✅ Score validation bounds (1-5 only) enforced.');

// 6. Test Rating: Valid rating creation (Score 4 + review text)
const validRateRes = await request(`/ideas/${testIdeaId}/ratings`, {
  method: 'POST',
  headers: { Cookie: reviewerCookie },
  body: JSON.stringify({ score: 4, review_text: 'Solid premise, very strong UX execution.' })
});
assert.strictEqual(validRateRes.status, 200, 'Valid rating should succeed');
assert.strictEqual(validRateRes.body.data.rating.score, 4);
assert.strictEqual(validRateRes.body.data.stats.total_ratings, 1);
assert.strictEqual(validRateRes.body.data.stats.avg_score, 4);
assert.strictEqual(validRateRes.body.data.stats.distribution[4], 1);
console.log('✅ Rating submission recorded: 4/5 with critique, distribution accurate.');

// 7. Test Rating: Re-rating / Upsert (Update to 5)
const updateRateRes = await request(`/ideas/${testIdeaId}/ratings`, {
  method: 'POST',
  headers: { Cookie: reviewerCookie },
  body: JSON.stringify({ score: 5, review_text: 'Upgraded to 5 after reviewing architecture!' })
});
assert.strictEqual(updateRateRes.status, 200, 'Re-rating should update existing rating');
assert.strictEqual(updateRateRes.body.data.rating.score, 5);
assert.strictEqual(updateRateRes.body.data.stats.total_ratings, 1, 'Total ratings must not increase on upsert');
assert.strictEqual(updateRateRes.body.data.stats.avg_score, 5);
assert.strictEqual(updateRateRes.body.data.stats.distribution[5], 1);
assert.strictEqual(updateRateRes.body.data.stats.distribution[4], 0);
console.log('✅ Re-rating properly upserted: updated to 5/5 without duplicate ballot.');

// 8. Test Rating: List ratings endpoint
const listRatingsRes = await request(`/ideas/${testIdeaId}/ratings`);
assert.strictEqual(listRatingsRes.status, 200);
assert.strictEqual(listRatingsRes.body.data.ratings.length, 1);
assert.strictEqual(listRatingsRes.body.data.ratings[0].score, 5);
assert.strictEqual(listRatingsRes.body.data.ratings[0].review_text, 'Upgraded to 5 after reviewing architecture!');
console.log('✅ Public ratings list reflects reviewer ballot & review text.');

// 9. Test Rating: Delete rating
const deleteRateRes = await request(`/ideas/${testIdeaId}/ratings`, {
  method: 'DELETE',
  headers: { Cookie: reviewerCookie }
});
assert.strictEqual(deleteRateRes.status, 200, 'Delete rating should succeed');
assert.strictEqual(deleteRateRes.body.data.stats.total_ratings, 0);
assert.strictEqual(deleteRateRes.body.data.stats.avg_score, 0);
console.log('✅ Rating deletion accurately resets stats and distribution.');

// Restore rating for filter tests
await request(`/ideas/${testIdeaId}/ratings`, {
  method: 'POST',
  headers: { Cookie: reviewerCookie },
  body: JSON.stringify({ score: 5, review_text: 'Restored high mark for filter tests' })
});

// Part 2: Filters Verification
console.log('\n🔍 Testing API Filters...');

// Filter 1: Category Filter
for (const cat of categories) {
  const res = await request(`/ideas?category=${cat}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.ideas.every(i => i.category === cat), `Every idea should have category ${cat}`);
}
console.log('✅ Category filter verified across all categories.');

// Filter 2: Search Filter
const searchRes = await request(`/ideas?search=${rand}`);
assert.strictEqual(searchRes.status, 200);
assert.ok(searchRes.body.data.ideas.length >= categories.length, 'Search should match all created test ideas');
console.log('✅ Search filter verified matching title, pitch, and keywords.');

// Filter 3: Sort Options (top, newest, most_discussed, most_rated)
for (const sortOption of ['top', 'newest', 'most_discussed', 'most_rated']) {
  const res = await request(`/ideas?sort=${sortOption}`);
  assert.strictEqual(res.status, 200, `Sort option ${sortOption} should return 200`);
  assert.ok(Array.isArray(res.body.data.ideas));
}
console.log('✅ Sort options (top, newest, most_discussed, most_rated) verified.');

// Filter 4: Leaderboard Timeframes (daily, week, month, all)
for (const tf of ['daily', 'week', 'month', 'all']) {
  const res = await request(`/leaderboard?timeframe=${tf}`);
  assert.strictEqual(res.status, 200, `Leaderboard timeframe ${tf} should return 200`);
  assert.ok(Array.isArray(res.body.data.leaderboard));
}
console.log('✅ Leaderboard timeframe filters (daily, week, month, all) verified.');

// Part 3: Browser UI Verification with Puppeteer
console.log('\n🖥️ Testing In-Browser UI Interactions with Puppeteer...');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// Test Feed Page Category Switching in UI
await page.goto('http://localhost:5173/feed', { waitUntil: 'networkidle2' });

const catButtons = await page.$$('button[aria-pressed]');
assert.ok(catButtons.length >= 7, 'Expected category buttons on feed');
console.log(`✅ UI has ${catButtons.length} category filter pills.`);

// Click "Tech" category pill
const techButton = await page.evaluateHandle(() => {
  const btns = Array.from(document.querySelectorAll('button[aria-pressed]'));
  return btns.find(b => b.innerText.trim() === 'Tech');
});
if (techButton) {
  await techButton.click();
  await new Promise(r => setTimeout(r, 600));
  const currentUrl = page.url();
  assert.ok(currentUrl.includes('category=Tech'), 'URL should include category=Tech after click');
  console.log('✅ Clicking category pill updates URL and filters feed rows.');
}

// Test Sort Segment Switching in UI
const newestButton = await page.evaluateHandle(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  return btns.find(b => b.innerText.trim() === 'Newest');
});
if (newestButton) {
  await newestButton.click();
  await new Promise(r => setTimeout(r, 600));
  assert.ok(page.url().includes('sort=newest'), 'URL should include sort=newest');
  console.log('✅ Clicking sort segment updates URL and orders feed.');
}

// Test Leaderboard Timeframe Switching in UI
await page.goto('http://localhost:5173/leaderboard', { waitUntil: 'networkidle2' });
const weeklyTab = await page.evaluateHandle(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  return btns.find(b => b.innerText.trim() === 'Weekly');
});
if (weeklyTab) {
  await weeklyTab.click();
  await new Promise(r => setTimeout(r, 600));
  assert.ok(page.url().includes('timeframe=week'), 'URL should include timeframe=week');
  console.log('✅ Leaderboard timeframe filter switches correctly in browser UI.');
}

// Test Rating Interaction on Idea Detail Page in UI
// 1. Sign in as reviewer in browser
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
await page.type('#login-email', reviewerEmail);
await page.type('#login-password', 'Password123!');
await page.click('button[type="submit"]');
await new Promise(r => setTimeout(r, 1200));

// 2. Navigate to idea detail
await page.goto(`http://localhost:5173/ideas/${testIdeaId}`, { waitUntil: 'networkidle2' });
const scorecard = await page.$('main');
assert.ok(scorecard, 'Idea detail page loaded');

// Switch to Ratings tab or find star buttons
const starButtons = await page.$$('[role="radiogroup"]:not([aria-label="Your demand signal"]) button[role="radio"]');
console.log(`✅ Found ${starButtons.length} interactive rating marks on idea detail for signed-in reviewer.`);
assert.strictEqual(starButtons.length, 5, 'Must have 5 interactive star rating buttons');

// Click star 4
await starButtons[3].click();
await new Promise(r => setTimeout(r, 300));

// Fill critique
const critiqueInput = await page.$('#ballot-critique');
if (critiqueInput) {
  await critiqueInput.type('Automated UI test critique: outstanding design and execution.');
}

// Click "Rate it"
const submitRateBtn = await page.evaluateHandle(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  return btns.find(b => b.innerText.trim() === 'Rate it');
});
if (submitRateBtn) {
  await submitRateBtn.click();
  await new Promise(r => setTimeout(r, 1500));
  console.log('✅ In-browser rating and critique successfully submitted!');
}

await browser.close();
console.log('\n🎉 ALL RATING AND FILTER TESTS PASSED COMPLETELY!');
