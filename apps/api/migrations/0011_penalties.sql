ALTER TABLE susu_groups ADD COLUMN penalty_percent INTEGER NOT NULL DEFAULT 2;
ALTER TABLE susu_groups ADD COLUMN penalty_pool_pesewas INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS susu_penalties (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id),
  round INTEGER NOT NULL,
  penalty_pesewas INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'late_contribution',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_penalties_group ON susu_penalties(group_id);
