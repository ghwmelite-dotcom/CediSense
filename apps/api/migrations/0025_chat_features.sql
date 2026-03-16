-- Read receipts: track last message seen per member per group
CREATE TABLE IF NOT EXISTS chat_read_receipts (
  member_id TEXT NOT NULL REFERENCES susu_members(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  last_read_message_id TEXT,
  last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, group_id)
);

-- Add reaction support
CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  message_id TEXT NOT NULL REFERENCES susu_messages(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(message_id, member_id, emoji)
);
CREATE INDEX idx_reactions_message ON message_reactions(message_id);

-- Add reply support
ALTER TABLE susu_messages ADD COLUMN reply_to_id TEXT REFERENCES susu_messages(id) ON DELETE SET NULL;

-- Add edit/delete support
ALTER TABLE susu_messages ADD COLUMN edited_at TEXT;
ALTER TABLE susu_messages ADD COLUMN deleted_at TEXT;
