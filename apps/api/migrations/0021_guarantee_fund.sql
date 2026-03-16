ALTER TABLE susu_groups ADD COLUMN guarantee_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE susu_groups ADD COLUMN guarantee_pool_pesewas INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS guarantee_claims (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  defaulting_member_id TEXT NOT NULL REFERENCES susu_members(id),
  round INTEGER NOT NULL,
  covered_amount_pesewas INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_guarantee_claims_group ON guarantee_claims(group_id);
