-- Migration: 0002_transactions.sql
-- Subsystem 2: Categories, Transactions, SMS Patterns, Category Rules
-- Also migrates accounts.balance_ghs (REAL) → balance_pesewas (INTEGER)

-- 1. Migrate accounts.balance_ghs → balance_pesewas
ALTER TABLE accounts ADD COLUMN balance_pesewas INTEGER NOT NULL DEFAULT 0;
UPDATE accounts SET balance_pesewas = CAST(balance_ghs * 100 AS INTEGER);

-- 2. Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name
  ON categories(user_id, name) WHERE user_id IS NOT NULL;

INSERT OR IGNORE INTO categories (id, user_id, name, icon, color, type, sort_order) VALUES
  ('cat_food',        NULL, 'Food & Groceries',   '🍲', '#F59E0B', 'expense', 1),
  ('cat_transport',   NULL, 'Transport',           '🚌', '#3B82F6', 'expense', 2),
  ('cat_utilities',   NULL, 'Utilities',           '💡', '#8B5CF6', 'expense', 3),
  ('cat_rent',        NULL, 'Rent & Housing',      '🏠', '#EC4899', 'expense', 4),
  ('cat_health',      NULL, 'Health',              '🏥', '#EF4444', 'expense', 5),
  ('cat_education',   NULL, 'Education',           '📚', '#06B6D4', 'expense', 6),
  ('cat_church',      NULL, 'Church/Tithe',        '⛪', '#D4A843', 'expense', 7),
  ('cat_family',      NULL, 'Family Support',      '👨‍👩‍👧', '#F97316', 'expense', 8),
  ('cat_momofees',    NULL, 'Mobile Money Fees',   '📱', '#6366F1', 'expense', 9),
  ('cat_shopping',    NULL, 'Shopping',            '🛍️', '#A855F7', 'expense', 10),
  ('cat_entertainment', NULL, 'Entertainment',     '🎬', '#14B8A6', 'expense', 11),
  ('cat_salary',      NULL, 'Salary',              '💰', '#22C55E', 'income', 12),
  ('cat_business',    NULL, 'Business Income',     '💼', '#10B981', 'income', 13),
  ('cat_remittance',  NULL, 'Remittance Received', '🌍', '#0EA5E9', 'income', 14),
  ('cat_momoin',      NULL, 'MoMo Transfer In',    '📲', '#FACC15', 'income', 15),
  ('cat_sidehustle',  NULL, 'Side Hustle',         '🔧', '#F472B6', 'income', 16),
  ('cat_interest',    NULL, 'Interest/Returns',    '📈', '#34D399', 'income', 17),
  ('cat_savings',     NULL, 'Savings/Susu',        '🏦', '#006B3F', 'transfer', 18);

-- 3. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'transfer')),
  amount_pesewas INTEGER NOT NULL,
  fee_pesewas INTEGER DEFAULT 0,
  description TEXT,
  raw_text TEXT,
  counterparty TEXT,
  reference TEXT,
  source TEXT NOT NULL CHECK (source IN ('sms_import', 'csv_import', 'manual')),
  categorized_by TEXT CHECK (categorized_by IN ('ai', 'user', 'rule') OR categorized_by IS NULL),
  transaction_date TEXT NOT NULL,
  import_batch_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_txn_user_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_txn_user_reference ON transactions(user_id, reference);

CREATE TRIGGER IF NOT EXISTS transactions_updated_at
  AFTER UPDATE ON transactions
  FOR EACH ROW
  BEGIN
    UPDATE transactions SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

-- 4. SMS Patterns table (registry/analytics only)
CREATE TABLE IF NOT EXISTS sms_patterns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  pattern_regex TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'transfer')),
  field_mapping TEXT NOT NULL,
  sample_sms TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 5. Category Rules table
CREATE TABLE IF NOT EXISTS category_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('contains', 'exact', 'regex')),
  match_field TEXT NOT NULL CHECK (match_field IN ('counterparty', 'description', 'provider')),
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rules_user_priority ON category_rules(user_id, priority DESC);
