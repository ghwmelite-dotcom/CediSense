-- Migration 0018: Auth upgrade for diaspora users
-- Adds email and country_code to users table for international phone support

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN country_code TEXT DEFAULT '+233';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
