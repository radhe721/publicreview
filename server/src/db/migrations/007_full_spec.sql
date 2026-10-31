-- 007_full_spec.sql
-- Remaining product spec: richer idea posts, drafts, edit history, builders, notifications,
-- reputation, moderation of comments/repos, launches with revenue, paid features and analytics.

-- 3.1 Post an idea: structured fields, drafts, visibility.
ALTER TABLE ideas ADD COLUMN problem TEXT;
ALTER TABLE ideas ADD COLUMN target_buyer TEXT;
ALTER TABLE ideas ADD COLUMN suggested_price INTEGER;           -- USD per month
ALTER TABLE ideas ADD COLUMN how_it_works TEXT;
ALTER TABLE ideas ADD COLUMN competitors TEXT;
ALTER TABLE ideas ADD COLUMN link_url TEXT;
ALTER TABLE ideas ADD COLUMN status TEXT NOT NULL DEFAULT 'published'; -- draft | published | hidden
-- 7 Launch tracking
ALTER TABLE ideas ADD COLUMN launched_url TEXT;
ALTER TABLE ideas ADD COLUMN launched_at TEXT;
ALTER TABLE ideas ADD COLUMN mrr_range TEXT;                    -- self-reported range, e.g. '1k_5k'
ALTER TABLE ideas ADD COLUMN mrr_verified_cents INTEGER;        -- from a read-only Stripe key (key never stored)
ALTER TABLE ideas ADD COLUMN mrr_verified_at DATETIME;
ALTER TABLE ideas ADD COLUMN show_exact_mrr INTEGER NOT NULL DEFAULT 0;
-- 6 Paid placement
ALTER TABLE ideas ADD COLUMN featured_until DATETIME;
ALTER TABLE ideas ADD COLUMN boosted_until DATETIME;
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);

-- Edit history, so ratings stay fair if an idea changes.
CREATE TABLE IF NOT EXISTS idea_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  pitch TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_idea_revisions_idea ON idea_revisions(idea_id);

-- 5.1 Profiles / 5.2 Reputation / 5.5 notification settings
ALTER TABLE users ADD COLUMN industry TEXT;
ALTER TABLE users ADD COLUMN country TEXT;
ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN notify_prefs TEXT;                 -- JSON, null = defaults
ALTER TABLE users ADD COLUMN pro_until DATETIME;
ALTER TABLE users ADD COLUMN report_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pro_credit_month TEXT;             -- 'YYYY-MM' of the last monthly Pro credit

CREATE TABLE IF NOT EXISTS reputation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                                           -- rating | helpful | winner
  ref_id INTEGER NOT NULL,
  points INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, kind, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_rep_events_user ON reputation_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge)
);

-- Founder marks structured feedback as helpful (+5 to the rater).
ALTER TABLE idea_feedback ADD COLUMN helpful INTEGER NOT NULL DEFAULT 0;

-- 5.3 Discussions: comment upvotes, hidden comments, comments on repos.
ALTER TABLE comments ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS comment_upvotes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE IF NOT EXISTS repo_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES shared_repos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES repo_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_repo_comments_repo ON repo_comments(repo_id);
ALTER TABLE shared_repos ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

-- 8.3 Reports on comments and repos (idea reports keep using the reports table).
CREATE TABLE IF NOT EXISTS content_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('comment', 'repo', 'repo_comment')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reporter_id, target_type, target_id)
);

-- 5.4 Builders and teams
CREATE TABLE IF NOT EXISTS build_interest (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idea_id, user_id)
);
CREATE TABLE IF NOT EXISTS cofounder_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  skills TEXT NOT NULL,
  looking_for TEXT NOT NULL,
  contact TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5.5 Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  link TEXT,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);

-- Weekly email: unsubscribe without an account.
ALTER TABLE waitlist_signups ADD COLUMN unsubscribed_at DATETIME;
ALTER TABLE waitlist_signups ADD COLUMN unsubscribe_token TEXT;

-- 6 Payments and Validation Reports
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
  product TEXT NOT NULL CHECK(product IN ('report', 'pro', 'featured')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'refunded', 'granted')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  provider_ref TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);

CREATE TABLE IF NOT EXISTS validation_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  public_token TEXT NOT NULL UNIQUE,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ends_at DATETIME NOT NULL,
  extended INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_validation_reports_idea ON validation_reports(idea_id);

-- Pro: fake-door landing page signups (email only, no account needed).
CREATE TABLE IF NOT EXISTS landing_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(idea_id, email)
);

-- Pro analytics: daily views by referrer host.
CREATE TABLE IF NOT EXISTS idea_views (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT 'direct',
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (idea_id, day, referrer)
);
