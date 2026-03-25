-- Pre-paid member tagging: creator can mark members who already received payout externally
ALTER TABLE susu_members ADD COLUMN pre_paid INTEGER NOT NULL DEFAULT 0;

-- Chat presence tracking: last time a user had the chat open
ALTER TABLE chat_read_receipts ADD COLUMN last_active_at TEXT;
