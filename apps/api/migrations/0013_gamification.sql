CREATE TABLE IF NOT EXISTS susu_badges (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  group_id TEXT REFERENCES susu_groups(id) ON DELETE SET NULL
);
CREATE INDEX idx_badges_user ON susu_badges(user_id);

ALTER TABLE trust_scores ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trust_scores ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0;
