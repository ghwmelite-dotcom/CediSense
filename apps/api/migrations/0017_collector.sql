CREATE TABLE IF NOT EXISTS collector_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  market_area TEXT,
  commission_days INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  total_clients INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collector_clients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  collector_id TEXT NOT NULL REFERENCES users(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  daily_amount_pesewas INTEGER NOT NULL CHECK(daily_amount_pesewas > 0),
  cycle_days INTEGER NOT NULL DEFAULT 30,
  current_cycle_start TEXT NOT NULL DEFAULT (date('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(collector_id, client_phone)
);
CREATE INDEX idx_collector_clients ON collector_clients(collector_id, is_active);

CREATE TABLE IF NOT EXISTS collector_deposits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id TEXT NOT NULL REFERENCES collector_clients(id) ON DELETE CASCADE,
  amount_pesewas INTEGER NOT NULL,
  deposit_date TEXT NOT NULL DEFAULT (date('now')),
  recorded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(client_id, deposit_date)
);
CREATE INDEX idx_collector_deposits ON collector_deposits(client_id, deposit_date);

CREATE TABLE IF NOT EXISTS collector_payouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id TEXT NOT NULL REFERENCES collector_clients(id),
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  total_deposited_pesewas INTEGER NOT NULL,
  commission_pesewas INTEGER NOT NULL,
  payout_pesewas INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT (datetime('now'))
);
