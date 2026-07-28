-- Feature 1 (streaks): system chat messages.
-- message_type distinguishes system-generated messages ('system') from
-- member-authored ones ('user'). Existing rows default to 'user'.
ALTER TABLE susu_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_susu_messages_type ON susu_messages(group_id, message_type);
