-- Recurring transactions with reminder config
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  expected_amount_pesewas INTEGER NOT NULL,
  amount_tolerance_percent INTEGER NOT NULL DEFAULT 20,
  frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'biweekly', 'monthly')),
  next_due_date TEXT NOT NULL,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_detected_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_recurring_user ON recurring_transactions(user_id, is_active);

-- Detected recurring candidates awaiting user review
CREATE TABLE IF NOT EXISTS recurring_candidates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty TEXT NOT NULL,
  category_id TEXT,
  avg_amount_pesewas INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'biweekly', 'monthly')),
  occurrence_count INTEGER NOT NULL,
  last_occurrence_date TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, counterparty)
);
CREATE INDEX idx_candidates_user ON recurring_candidates(user_id, dismissed);
