-- Migration 0030: Add missing event_name and event_date columns to susu_groups
-- These columns were referenced in the groups.ts route handler but never migrated
ALTER TABLE susu_groups ADD COLUMN event_name TEXT;
ALTER TABLE susu_groups ADD COLUMN event_date TEXT;
