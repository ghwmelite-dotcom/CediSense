-- Feature 3 (due-date nudges): track when the current round began so the
-- cron can compute due windows per frequency. Backfill: existing groups
-- start their window at the row's created_at.
ALTER TABLE susu_groups ADD COLUMN round_started_at TEXT;
UPDATE susu_groups SET round_started_at = created_at WHERE round_started_at IS NULL;
