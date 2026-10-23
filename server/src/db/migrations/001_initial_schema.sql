-- 001_initial_schema.sql
-- Normalized SQL schema for IdeaPulse (portable to PostgreSQL)

PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  avatar_url TEXT,
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ideas table
CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pitch TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Tech', 'Business', 'Design', 'Social', 'Education', 'Other')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Idea-Tags Junction
CREATE TABLE IF NOT EXISTS idea_tags (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, tag_id)
);

-- Ratings table (1-5 stars, one per user per idea)
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
  review_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, idea_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports table for basic moderation (one report per user per idea)
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reporter_id, idea_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_idea_id ON ratings(idea_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_idea_id ON comments(idea_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_reports_idea_id ON reports(idea_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_user_idea ON reports(reporter_id, idea_id);

-- Aggregated Statistics View for ideas
CREATE VIEW IF NOT EXISTS idea_stats_view AS
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
LEFT JOIN ratings r ON i.id = r.idea_id
GROUP BY i.id;
