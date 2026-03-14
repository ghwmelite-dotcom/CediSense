CREATE TABLE IF NOT EXISTS ious (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  description TEXT,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  direction TEXT NOT NULL CHECK(direction IN ('owed_to_me', 'i_owe')),
  is_settled INTEGER NOT NULL DEFAULT 0,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ious_user ON ious(user_id, is_settled);
