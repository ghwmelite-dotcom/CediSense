-- Migration 0020: Diaspora Remittance Susu with multi-currency support
-- Adds currency tracking columns to groups and contributions

ALTER TABLE susu_groups ADD COLUMN base_currency TEXT DEFAULT 'GHS';
ALTER TABLE susu_contributions ADD COLUMN original_currency TEXT DEFAULT 'GHS';
ALTER TABLE susu_contributions ADD COLUMN original_amount INTEGER;
ALTER TABLE susu_contributions ADD COLUMN exchange_rate REAL;
