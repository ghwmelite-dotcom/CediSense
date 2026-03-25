-- =============================================
-- Missing indexes identified in performance audit
-- =============================================

-- 1. Foreign key columns used in JOINs (Critical)
CREATE INDEX IF NOT EXISTS idx_susu_contributions_group ON susu_contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_susu_payouts_group ON susu_payouts(group_id);
CREATE INDEX IF NOT EXISTS idx_funeral_claims_member ON funeral_claims(claimant_member_id);
CREATE INDEX IF NOT EXISTS idx_welfare_claims_member ON welfare_claims(claimant_member_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_member ON message_reactions(member_id);
CREATE INDEX IF NOT EXISTS idx_early_payout_votes_member ON early_payout_votes(member_id);

-- 2. chat_read_receipts (Critical - zero indexes currently)
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_member ON chat_read_receipts(member_id);
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_group ON chat_read_receipts(group_id);

-- 3. Transaction account+date for import dedup and CSV export (High)
CREATE INDEX IF NOT EXISTS idx_txn_account_date ON transactions(account_id, transaction_date DESC);

-- 4. Susu members composite for membership lookups (High)
CREATE INDEX IF NOT EXISTS idx_susu_members_group_user ON susu_members(group_id, user_id);

-- 5. Susu contributions member lookup (Medium)
CREATE INDEX IF NOT EXISTS idx_susu_contributions_member ON susu_contributions(member_id);

-- 6. Message reactions message lookup for batch fetch (Medium)
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
