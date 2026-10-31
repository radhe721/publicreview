-- 008_x_linkedin_targeting.sql
-- Sign-in / account linking with X and LinkedIn (drops the google/github-only CHECK), and
-- Pro targeted raters (roles and industry an idea is shown to first).

CREATE TABLE IF NOT EXISTS oauth_accounts_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('google', 'github', 'x', 'linkedin')),
  provider_user_id TEXT NOT NULL,
  email TEXT,
  username TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id),
  UNIQUE(user_id, provider)
);
INSERT INTO oauth_accounts_v2 (id, user_id, provider, provider_user_id, email, created_at)
SELECT id, user_id, provider, provider_user_id, email, created_at FROM oauth_accounts;
DROP TABLE oauth_accounts;
ALTER TABLE oauth_accounts_v2 RENAME TO oauth_accounts;
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);

ALTER TABLE ideas ADD COLUMN target_roles TEXT;      -- comma-separated role tags
ALTER TABLE ideas ADD COLUMN target_industry TEXT;
