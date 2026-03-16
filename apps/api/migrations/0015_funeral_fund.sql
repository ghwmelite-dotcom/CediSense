-- Funeral Fund (Asie/Adosia) — emergency bereavement susu with claim voting
-- Note: SQLite doesn't support ALTER CHECK, so funeral_fund variant is enforced in app logic

CREATE TABLE IF NOT EXISTS funeral_claims (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  claimant_member_id TEXT NOT NULL REFERENCES susu_members(id),
  deceased_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  description TEXT,
  amount_pesewas INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'denied')),
  approved_by_count INTEGER NOT NULL DEFAULT 0,
  denied_by_count INTEGER NOT NULL DEFAULT 0,
  approval_threshold INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX idx_funeral_claims_group ON funeral_claims(group_id, status);

CREATE TABLE IF NOT EXISTS funeral_claim_votes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  claim_id TEXT NOT NULL REFERENCES funeral_claims(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id),
  vote TEXT NOT NULL CHECK(vote IN ('approve', 'deny')),
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(claim_id, member_id)
);
