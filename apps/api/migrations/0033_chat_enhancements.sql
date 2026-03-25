-- Pinned messages
CREATE TABLE IF NOT EXISTS pinned_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES susu_messages(id) ON DELETE CASCADE,
  pinned_by TEXT NOT NULL REFERENCES susu_members(id),
  pinned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_group ON pinned_messages(group_id, pinned_at DESC);
