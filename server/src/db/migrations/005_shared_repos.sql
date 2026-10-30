-- 005_shared_repos.sql
-- GitHub repositories shared by the community. Repo details are copied from the GitHub API when
-- the repo is shared; github_id (not the name) keeps a renamed or transferred repo from being added twice.
CREATE TABLE IF NOT EXISTS shared_repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_id INTEGER NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  owner_avatar TEXT,
  description TEXT,
  language TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  topics TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shared_repos_created_at ON shared_repos(created_at);
CREATE INDEX IF NOT EXISTS idx_shared_repos_user_id ON shared_repos(user_id);

CREATE TABLE IF NOT EXISTS repo_upvotes (
  repo_id INTEGER NOT NULL REFERENCES shared_repos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (repo_id, user_id)
);
