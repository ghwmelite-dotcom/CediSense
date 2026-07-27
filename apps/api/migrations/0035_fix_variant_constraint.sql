-- Fix: widen susu_groups.variant CHECK to all 11 supported variants.
--
-- 0012_susu_variants.sql introduced the variant column with
-- CHECK(variant IN ('rotating','accumulating','goal_based','bidding')), but
-- later migrations (0015 funeral_fund, 0019 school_fees, 0020 diaspora,
-- 0022 bulk_purchase, 0023 agricultural, 0024 welfare, plus event_fund via
-- the create schema) never widened it. Creating a group with any of those
-- seven variants failed with SQLITE_CONSTRAINT (surfaced as HTTP 500).
--
-- SQLite cannot alter a CHECK constraint in place — the table must be
-- rebuilt. defer_foreign_keys keeps child tables (susu_members,
-- susu_contributions, …) valid across the swap.

PRAGMA defer_foreign_keys = true;

CREATE TABLE susu_groups_new (
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  penalty_percent INTEGER NOT NULL DEFAULT 2,
  penalty_pool_pesewas INTEGER NOT NULL DEFAULT 0,
  variant TEXT NOT NULL DEFAULT 'rotating'
    CHECK(variant IN ('rotating', 'accumulating', 'goal_based', 'bidding',
                      'funeral_fund', 'school_fees', 'diaspora', 'event_fund',
                      'bulk_purchase', 'agricultural', 'welfare')),
  goal_amount_pesewas INTEGER,
  goal_description TEXT,
  target_term TEXT,
  school_name TEXT,
  base_currency TEXT DEFAULT 'GHS',
  guarantee_percent INTEGER NOT NULL DEFAULT 0,
  guarantee_pool_pesewas INTEGER NOT NULL DEFAULT 0,
  supplier_name TEXT,
  supplier_contact TEXT,
  item_description TEXT,
  estimated_savings_percent INTEGER,
  crop_type TEXT,
  planting_month INTEGER,
  harvest_month INTEGER,
  organization_name TEXT,
  organization_type TEXT CHECK(organization_type IN ('church', 'mosque', 'community', 'other')),
  event_name TEXT,
  event_date TEXT
);

INSERT INTO susu_groups_new (
  id, name, creator_id, invite_code, contribution_pesewas, frequency,
  max_members, current_round, is_active, created_at, updated_at,
  penalty_percent, penalty_pool_pesewas, variant, goal_amount_pesewas,
  goal_description, target_term, school_name, base_currency,
  guarantee_percent, guarantee_pool_pesewas, supplier_name, supplier_contact,
  item_description, estimated_savings_percent, crop_type, planting_month,
  harvest_month, organization_name, organization_type, event_name, event_date
)
SELECT
  id, name, creator_id, invite_code, contribution_pesewas, frequency,
  max_members, current_round, is_active, created_at, updated_at,
  penalty_percent, penalty_pool_pesewas, variant, goal_amount_pesewas,
  goal_description, target_term, school_name, base_currency,
  guarantee_percent, guarantee_pool_pesewas, supplier_name, supplier_contact,
  item_description, estimated_savings_percent, crop_type, planting_month,
  harvest_month, organization_name, organization_type, event_name, event_date
FROM susu_groups;

DROP TABLE susu_groups;
ALTER TABLE susu_groups_new RENAME TO susu_groups;

CREATE INDEX idx_susu_groups_creator ON susu_groups(creator_id);
CREATE INDEX idx_susu_groups_invite ON susu_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_susu_groups_created ON susu_groups(created_at DESC);
