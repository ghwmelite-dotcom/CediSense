-- Migration 0031: Admin portal — role, is_active, audit log, activity feed indexes

-- Add role and is_active to users
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_users_role ON users(role);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  admin_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at DESC);

-- Activity feed indexes (tables lack created_at indexes)
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_groups_created ON susu_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_contributions_created ON susu_contributions(contributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_payouts_created ON susu_payouts(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_members_joined ON susu_members(joined_at DESC);
