-- Collector indexes
CREATE INDEX IF NOT EXISTS idx_collector_payouts_client_date ON collector_payouts(client_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_collector_deposits_date ON collector_deposits(deposit_date);

-- Susu message index for chat pagination
CREATE INDEX IF NOT EXISTS idx_susu_messages_group_date ON susu_messages(group_id, created_at DESC);
