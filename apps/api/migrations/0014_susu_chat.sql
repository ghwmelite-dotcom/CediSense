CREATE TABLE IF NOT EXISTS susu_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_susu_messages_group ON susu_messages(group_id, created_at DESC);
