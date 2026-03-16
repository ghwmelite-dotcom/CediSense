-- Migration 0019: School Fees Term Saver susu variant
-- Adds target_term and school_name columns to susu_groups

ALTER TABLE susu_groups ADD COLUMN target_term TEXT;
ALTER TABLE susu_groups ADD COLUMN school_name TEXT;
