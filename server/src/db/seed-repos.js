// Adds 25 real open-source SaaS projects to the Open-Source SaaS section, posted by the "BusinessListe Team"
// account. Safe to run on any database, production included: it never deletes anything, skips repos that
// are already shared, and takes stars, license and description live from the GitHub API (nothing invented).
//
// Usage: npm run seed:repos --prefix server   (add -- --refresh to update stars of existing ones;
// set GITHUB_TOKEN to avoid GitHub's 60 lookups/hour limit). Admins can also run it from /admin.
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { runMigrations } from './migrate.js';
import { fetchGithubRepo, GithubLookupError } from '../services/github.js';
import { TEAM_NAME } from '../services/ranking.js';

export const TEAM_EMAIL = 'team@businessliste.com';

// business_model: 'self_host' (free self-host only) · 'paid_cloud' (has a paid cloud plan) · 'open_core'
export const SEED_REPOS = [
  { repo: 'gitroomhq/postiz-app', category: 'Social media', business_model: 'paid_cloud', note: 'Open-source social media scheduler with a paid cloud plan; one of the highest-earning open-source SaaS products.' },
  { repo: 'calcom/cal.com', category: 'Scheduling', business_model: 'open_core', note: 'Calendly alternative. A niche version (clinics, tutors, salons) is a common build.' },
  { repo: 'plausible/analytics', category: 'Analytics', business_model: 'paid_cloud', note: 'Privacy-friendly Google Analytics alternative, funded entirely by its cloud plan.' },
  { repo: 'umami-software/umami', category: 'Analytics', business_model: 'paid_cloud', note: 'Simple, privacy-first web analytics.' },
  { repo: 'PostHog/posthog', category: 'Analytics', business_model: 'open_core', note: 'Product analytics, session replay and feature flags.' },
  { repo: 'formbricks/formbricks', category: 'Forms & surveys', business_model: 'open_core', note: 'Typeform / Qualtrics alternative for in-product surveys.' },
  { repo: 'baptisteArno/typebot.io', category: 'Forms & surveys', business_model: 'paid_cloud', note: 'Conversational forms and chatbot builder.' },
  { repo: 'twentyhq/twenty', category: 'CRM', business_model: 'paid_cloud', note: 'Modern Salesforce alternative; good base for a vertical CRM.' },
  { repo: 'chatwoot/chatwoot', category: 'Customer support', business_model: 'open_core', note: 'Intercom / Zendesk alternative for live chat and support inboxes.' },
  { repo: 'documenso/documenso', category: 'Documents', business_model: 'paid_cloud', note: 'DocuSign alternative for e-signatures.' },
  { repo: 'n8n-io/n8n', category: 'Automation', business_model: 'paid_cloud', note: 'Zapier alternative. Fair-code license: check the limits before reselling it.' },
  { repo: 'appsmithorg/appsmith', category: 'Internal tools', business_model: 'open_core', note: 'Retool alternative for building admin panels and internal apps.' },
  { repo: 'ToolJet/ToolJet', category: 'Internal tools', business_model: 'open_core', note: 'Low-code internal tool builder.' },
  { repo: 'supabase/supabase', category: 'Backend', business_model: 'paid_cloud', note: 'Firebase alternative built on Postgres.' },
  { repo: 'appwrite/appwrite', category: 'Backend', business_model: 'paid_cloud', note: 'Backend-as-a-service: auth, database, storage and functions.' },
  { repo: 'knadh/listmonk', category: 'Email marketing', business_model: 'self_host', note: 'Self-hosted newsletter and mailing list manager. No official cloud: room for a hosted version.' },
  { repo: 'mautic/mautic', category: 'Email marketing', business_model: 'self_host', note: 'Marketing automation platform.' },
  { repo: 'getlago/lago', category: 'Billing', business_model: 'open_core', note: 'Usage-based billing and metering.' },
  { repo: 'dubinc/dub', category: 'Marketing', business_model: 'paid_cloud', note: 'Link shortener and link attribution for marketing teams.' },
  { repo: 'novuhq/novu', category: 'Developer tools', business_model: 'paid_cloud', note: 'Notification infrastructure: email, SMS, push and in-app.' },
  { repo: 'hoppscotch/hoppscotch', category: 'Developer tools', business_model: 'paid_cloud', note: 'Postman alternative for testing APIs.' },
  { repo: 'outline/outline', category: 'Knowledge base', business_model: 'paid_cloud', note: 'Team wiki and knowledge base (Notion / Confluence alternative).' },
  { repo: 'AppFlowy-IO/AppFlowy', category: 'Productivity', business_model: 'paid_cloud', note: 'Notion alternative for notes, docs and projects.' },
  { repo: 'makeplane/plane', category: 'Project management', business_model: 'paid_cloud', note: 'Jira / Linear alternative for project tracking.' },
  { repo: 'louislam/uptime-kuma', category: 'Monitoring', business_model: 'self_host', note: 'Self-hosted uptime monitoring. No official cloud: a hosted status-page SaaS is a common build.' }
];

async function getTeamUserId() {
  const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(TEAM_EMAIL);
  if (existing) return existing.id;
  // Random password nobody knows: the account only exists so team posts have an owner.
  const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const result = await db.prepare(`
    INSERT INTO users (name, email, password_hash, role, bio)
    VALUES (?, ?, ?, 'user', 'Seed content added by the BusinessListe team to get the community started.')
  `).run(TEAM_NAME, TEAM_EMAIL, hash);
  return result.lastInsertRowid;
}

export async function seedRepos({ log = console.log, refresh = false } = {}) {
  await runMigrations();
  const teamId = await getTeamUserId();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const failed = [];
  let rateLimited = false;

  for (const entry of SEED_REPOS) {
    const [owner, name] = entry.repo.split('/');
    // Already seeded by name: skip the GitHub call, so a re-run after a rate limit only fetches what is missing.
    const known = await db.prepare('SELECT id FROM shared_repos WHERE LOWER(full_name) = LOWER(?)').get(entry.repo);
    if (known && !refresh) {
      await db.prepare('UPDATE shared_repos SET category = COALESCE(category, ?), business_model = COALESCE(business_model, ?) WHERE id = ?')
        .run(entry.category, entry.business_model, known.id);
      skipped++;
      continue;
    }
    if (rateLimited) {
      failed.push(`${entry.repo}: waiting for GitHub rate limit`);
      continue;
    }
    let details;
    try {
      details = await fetchGithubRepo({ owner, name });
    } catch (err) {
      if (err instanceof GithubLookupError && err.statusCode === 503) rateLimited = true;
      failed.push(`${entry.repo}: ${err instanceof GithubLookupError ? err.message : err}`);
      continue;
    }

    const existing = await db.prepare('SELECT id FROM shared_repos WHERE github_id = ?').get(details.github_id);
    if (existing) {
      // Refresh the live GitHub numbers and fill in category / model; never touch who shared it or their note.
      await db.prepare(`
        UPDATE shared_repos
        SET stars = ?, forks = ?, description = ?, license = ?, pushed_at = ?,
            category = COALESCE(category, ?), business_model = COALESCE(business_model, ?)
        WHERE id = ?
      `).run(details.stars, details.forks, details.description, details.license, details.pushed_at,
        entry.category, entry.business_model, existing.id);
      updated++;
      continue;
    }

    await db.prepare(`
      INSERT INTO shared_repos
        (user_id, github_id, full_name, owner_avatar, description, language, stars, forks, topics, note,
         license, pushed_at, category, business_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(teamId, details.github_id, details.full_name, details.owner_avatar, details.description, details.language,
      details.stars, details.forks, JSON.stringify(details.topics), entry.note, details.license, details.pushed_at,
      entry.category, entry.business_model);
    added++;
    log(`  + ${details.full_name} (${details.stars}★, ${details.license || 'no license'})`);
  }

  log(`Open-Source SaaS seed: ${added} added, ${updated} refreshed, ${skipped} already there, ${failed.length} not done.`);
  for (const f of failed) log(`  ! ${f}`);
  if (rateLimited) {
    log('GitHub rate limit reached (60 lookups/hour without a token). Set GITHUB_TOKEN or run this again in an hour; it continues where it stopped.');
  }
  const total = await db.prepare('SELECT COUNT(*) AS n FROM shared_repos').get();
  return { added, updated, skipped, failed, rate_limited: rateLimited, total: Number(total.n) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seedRepos({ refresh: process.argv.includes('--refresh') });
    process.exit(0);
  } catch (err) {
    console.error('Repo seed failed:', err);
    process.exit(1);
  }
}
