CREATE TABLE IF NOT EXISTS trust_scores (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 50 CHECK(score >= 0 AND score <= 100),
  total_contributions INTEGER NOT NULL DEFAULT 0,
  on_time_contributions INTEGER NOT NULL DEFAULT 0,
  late_contributions INTEGER NOT NULL DEFAULT 0,
  missed_contributions INTEGER NOT NULL DEFAULT 0,
  groups_completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
