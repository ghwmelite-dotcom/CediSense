CREATE TABLE IF NOT EXISTS early_payout_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  requester_member_id TEXT NOT NULL REFERENCES susu_members(id),
  reason TEXT,
  amount_pesewas INTEGER NOT NULL,
  premium_percent INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied', 'paid')),
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_needed INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX idx_early_payout_group ON early_payout_requests(group_id, status);

CREATE TABLE IF NOT EXISTS early_payout_votes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  request_id TEXT NOT NULL REFERENCES early_payout_requests(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id),
  vote TEXT NOT NULL CHECK(vote IN ('for', 'against')),
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(request_id, member_id)
);
