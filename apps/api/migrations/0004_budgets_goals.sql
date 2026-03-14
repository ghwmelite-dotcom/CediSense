-- Budgets: monthly per-category spending limits
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, category_id)
);
CREATE INDEX idx_budgets_user ON budgets(user_id);

-- Savings goals with manual contributions
CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_pesewas INTEGER NOT NULL CHECK(target_pesewas > 0),
  current_pesewas INTEGER NOT NULL DEFAULT 0 CHECK(current_pesewas >= 0),
  deadline TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_savings_goals_user ON savings_goals(user_id);
