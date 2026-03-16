-- D3: Missing index on chat_messages.user_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- D3: Compound index for badge lookups
CREATE INDEX IF NOT EXISTS idx_susu_badges_lookup ON susu_badges(user_id, badge_type, group_id);

-- D6: SQLite can't add CHECK constraints via ALTER TABLE.
-- commission_days is validated in application code via Zod schema (1-5).
