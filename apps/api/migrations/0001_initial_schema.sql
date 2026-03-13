-- Migration 0001: Auth & Core Tables
-- CediSense Subsystem 1: Scaffolding + Auth

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  monthly_income_ghs REAL,
  preferred_language TEXT DEFAULT 'en',
  onboarding_completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Trigger: auto-update updated_at on user changes
CREATE TRIGGER IF NOT EXISTS users_updated_at AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Auth Methods (extensible: pin now, webauthn/otp/social later)
CREATE TABLE IF NOT EXISTS auth_methods (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  credential TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Accounts (MoMo wallets, bank accounts, cash)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('momo','bank','cash','susu')),
  provider TEXT,
  account_number TEXT,
  balance_ghs REAL DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_methods_user ON auth_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
