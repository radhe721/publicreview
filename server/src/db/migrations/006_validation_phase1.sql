-- 006_validation_phase1.sql
-- Phase 1 of the product spec: honest seed labels, voter roles, structured feedback,
-- new monthly price ranges, vote-burst holds, and richer open-source repo details.

-- Content posted by the BusinessListe team (cold-start seed) is labelled as such, never as a real user.
ALTER TABLE ideas ADD COLUMN is_team_seed INTEGER NOT NULL DEFAULT 0;

-- What kind of person a voter is (freelancer, developer, ...), so results show who voted.
ALTER TABLE users ADD COLUMN role_tag TEXT;

-- Ratings caught in a vote burst are held for admin review and left out of every score until released.
ALTER TABLE ratings ADD COLUMN held INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_ratings_held ON ratings(held);

-- demand_signals is rebuilt to drop the old 4-tier CHECK (new ranges: $0-5, $5-15, $15-30, $30-100, $100+)
-- and to add the same held flag. Old tier values are kept as-is and still counted.
CREATE TABLE IF NOT EXISTS demand_signals_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK(intent IN ('pass', 'maybe', 'would_pay')),
  price_tier TEXT,
  join_waitlist INTEGER NOT NULL DEFAULT 0 CHECK(join_waitlist IN (0, 1)),
  held INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, idea_id)
);

INSERT INTO demand_signals_v2 (id, user_id, idea_id, intent, price_tier, join_waitlist, created_at, updated_at)
SELECT id, user_id, idea_id, intent, price_tier, join_waitlist, created_at, updated_at FROM demand_signals;

DROP TABLE demand_signals;
ALTER TABLE demand_signals_v2 RENAME TO demand_signals;
CREATE INDEX IF NOT EXISTS idx_demand_signals_idea_id ON demand_signals(idea_id);
CREATE INDEX IF NOT EXISTS idx_demand_signals_held ON demand_signals(held);

-- Structured feedback: four quick questions plus one optional comment (one per user per idea).
CREATE TABLE IF NOT EXISTS idea_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  problem_real INTEGER NOT NULL CHECK(problem_real BETWEEN 1 AND 5),
  buyer_would_pay INTEGER NOT NULL CHECK(buyer_would_pay BETWEEN 1 AND 5),
  price_fit TEXT CHECK(price_fit IS NULL OR price_fit IN ('too_low', 'right', 'too_high')),
  competitor TEXT,
  would_make_pay TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, idea_id)
);

CREATE INDEX IF NOT EXISTS idx_idea_feedback_idea_id ON idea_feedback(idea_id);

-- Stats view: held ratings never count.
DROP VIEW IF EXISTS idea_stats_view;
CREATE VIEW idea_stats_view AS
SELECT
  i.id AS idea_id,
  COUNT(r.id) AS total_ratings,
  ROUND(COALESCE(AVG(CAST(r.score AS REAL)), 0.0), 2) AS avg_score,
  SUM(CASE WHEN r.score = 5 THEN 1 ELSE 0 END) AS score_5_count,
  SUM(CASE WHEN r.score = 4 THEN 1 ELSE 0 END) AS score_4_count,
  SUM(CASE WHEN r.score = 3 THEN 1 ELSE 0 END) AS score_3_count,
  SUM(CASE WHEN r.score = 2 THEN 1 ELSE 0 END) AS score_2_count,
  SUM(CASE WHEN r.score = 1 THEN 1 ELSE 0 END) AS score_1_count,
  (SELECT COUNT(*) FROM comments c WHERE c.idea_id = i.id) AS comments_count
FROM ideas i
LEFT JOIN ratings r ON i.id = r.idea_id AND r.held = 0
GROUP BY i.id;

-- Open-Source SaaS details: license, last commit, category and business model.
ALTER TABLE shared_repos ADD COLUMN license TEXT;
ALTER TABLE shared_repos ADD COLUMN pushed_at TEXT;
ALTER TABLE shared_repos ADD COLUMN category TEXT;
ALTER TABLE shared_repos ADD COLUMN business_model TEXT;
