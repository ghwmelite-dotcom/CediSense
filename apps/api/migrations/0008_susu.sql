CREATE TABLE IF NOT EXISTS susu_groups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  contribution_pesewas INTEGER NOT NULL CHECK(contribution_pesewas > 0),
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
  max_members INTEGER NOT NULL DEFAULT 12 CHECK(max_members >= 2 AND max_members <= 50),
  current_round INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS susu_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  payout_order INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id),
  UNIQUE(group_id, payout_order)
);

CREATE TABLE IF NOT EXISTS susu_contributions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  contributed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, member_id, round)
);

CREATE TABLE IF NOT EXISTS susu_payouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, round)
);

CREATE INDEX idx_susu_groups_creator ON susu_groups(creator_id);
CREATE INDEX idx_susu_groups_invite ON susu_groups(invite_code);
CREATE INDEX idx_susu_members_group ON susu_members(group_id);
CREATE INDEX idx_susu_members_user ON susu_members(user_id);
CREATE INDEX idx_susu_contributions_group_round ON susu_contributions(group_id, round);
CREATE INDEX idx_susu_payouts_group_round ON susu_payouts(group_id, round);
