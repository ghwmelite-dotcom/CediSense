-- Church/Mosque Welfare Digitization variant
ALTER TABLE susu_groups ADD COLUMN organization_name TEXT;
ALTER TABLE susu_groups ADD COLUMN organization_type TEXT CHECK(organization_type IN ('church', 'mosque', 'community', 'other'));

CREATE TABLE IF NOT EXISTS welfare_claims (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  claimant_member_id TEXT NOT NULL REFERENCES susu_members(id),
  claim_type TEXT NOT NULL CHECK(claim_type IN ('medical', 'funeral', 'education', 'emergency', 'other')),
  description TEXT NOT NULL,
  amount_requested_pesewas INTEGER NOT NULL,
  amount_approved_pesewas INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'partially_approved', 'denied', 'paid')),
  approved_by TEXT REFERENCES susu_members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX idx_welfare_claims_group ON welfare_claims(group_id, status);
