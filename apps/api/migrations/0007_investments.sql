CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('tbill', 'mutual_fund', 'fixed_deposit', 'other')),
  name TEXT NOT NULL,
  institution TEXT,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  rate_percent REAL CHECK(rate_percent >= 0 AND rate_percent <= 100),
  purchase_date TEXT NOT NULL,
  maturity_date TEXT,
  current_value_pesewas INTEGER CHECK(current_value_pesewas > 0),
  is_matured INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_investments_user ON investments(user_id, is_matured);
CREATE INDEX idx_investments_user_type ON investments(user_id, type);
