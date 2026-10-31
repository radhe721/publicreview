// Weekly email: "Top validated ideas this week", to email subscribers and to users who keep the
// weekly email switched on. Run once a week, e.g. a cron on the VM:
//   0 9 * * 1  cd ~/publicreview && docker compose --env-file .env -f deploy/docker-compose.yml exec -T app node server/src/db/send-weekly-email.js
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { env } from '../config/env.js';
import { sendMail } from '../services/mailer.js';
import { resolvePrefs } from '../services/notify.js';
import { runMigrations } from './migrate.js';
import { getDemandSummary } from '../controllers/demand.controller.js';

export async function buildWeeklyDigest() {
  // Ideas with the most "I'd pay" votes cast this week.
  const rows = await db.prepare(`
    SELECT i.id, i.title, i.pitch, COUNT(*) AS week_votes
    FROM demand_signals d JOIN ideas i ON i.id = d.idea_id
    WHERE d.held = 0 AND d.created_at >= datetime('now', '-7 days') AND i.status = 'published'
    GROUP BY i.id
    ORDER BY SUM(CASE WHEN d.intent = 'would_pay' THEN 1 ELSE 0 END) DESC, week_votes DESC
    LIMIT 5
  `).all();
  const ideas = [];
  for (const r of rows) ideas.push({ ...r, demand: await getDemandSummary(r.id) });
  const fresh = await db.prepare(`
    SELECT id, title FROM ideas WHERE status = 'published' AND created_at >= datetime('now', '-7 days') ORDER BY created_at DESC LIMIT 5
  `).all();
  return { ideas, fresh };
}

export function renderDigest({ ideas, fresh }, unsubscribeUrl) {
  const lines = ['Top validated ideas this week', ''];
  if (ideas.length === 0) lines.push('No idea collected votes this week. Be the first: ' + `${env.CLIENT_URL}/feed?sort=needs_votes`);
  ideas.forEach((i, n) => {
    const d = i.demand;
    lines.push(`${n + 1}. ${i.title}`);
    lines.push(`   ${i.pitch}`);
    lines.push(`   ${d.pay_rate}% would pay${d.median_price ? ` · median ${d.median_price.label}/month` : ''} · ${d.total} votes`);
    lines.push(`   ${env.CLIENT_URL}/ideas/${i.id}`);
    lines.push('');
  });
  if (fresh.length) {
    lines.push('New this week, needs your vote:');
    fresh.forEach((f) => lines.push(`- ${f.title}: ${env.CLIENT_URL}/ideas/${f.id}`));
    lines.push('');
  }
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
  return lines.join('\n');
}

export async function sendWeeklyEmail({ log = console.log } = {}) {
  await runMigrations();
  const digest = await buildWeeklyDigest();
  const sent = new Set();

  const subscribers = await db.prepare('SELECT id, email, unsubscribe_token FROM waitlist_signups WHERE unsubscribed_at IS NULL').all();
  for (const s of subscribers) {
    let token = s.unsubscribe_token;
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      await db.prepare('UPDATE waitlist_signups SET unsubscribe_token = ? WHERE id = ?').run(token, s.id);
    }
    const email = String(s.email).toLowerCase();
    await sendMail({ to: email, subject: 'Top validated ideas this week', text: renderDigest(digest, `${env.CLIENT_URL}/unsubscribe?token=${token}`) });
    sent.add(email);
  }

  const users = await db.prepare("SELECT email, notify_prefs FROM users WHERE email NOT LIKE '%@businessliste.com'").all();
  for (const u of users) {
    const email = String(u.email).toLowerCase();
    if (sent.has(email) || !resolvePrefs(u.notify_prefs).weekly.email) continue;
    await sendMail({ to: email, subject: 'Top validated ideas this week', text: renderDigest(digest, `${env.CLIENT_URL}/notifications`) });
    sent.add(email);
  }
  log(`Weekly email sent to ${sent.size} people.`);
  return sent.size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await sendWeeklyEmail();
    process.exit(0);
  } catch (err) {
    console.error('Weekly email failed:', err);
    process.exit(1);
  }
}
