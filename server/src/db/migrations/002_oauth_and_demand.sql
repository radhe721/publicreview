-- 002_oauth_and_demand.sql
-- OAuth sign-in (Google, GitHub), server-side session revocation, and demand validation signals.

-- Bumped whenever all existing sessions for a user must be invalidated.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Linked third-party identities. A user may have several (one per provider).
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('google', 'github')),
  provider_user_id TEXT NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);

-- Demand signals: "would you actually use / pay for this?" (one per user per idea)
CREATE TABLE IF NOT EXISTS demand_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK(intent IN ('pass', 'maybe', 'would_pay')),
  price_tier TEXT CHECK(price_tier IS NULL OR price_tier IN ('under_10', '10_to_30', '30_to_100', 'over_100')),
  -- Explicit consent to share the voter's name and email with the idea's creator for launch updates.
  join_waitlist INTEGER NOT NULL DEFAULT 0 CHECK(join_waitlist IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, idea_id)
);

CREATE INDEX IF NOT EXISTS idx_demand_signals_idea_id ON demand_signals(idea_id);
