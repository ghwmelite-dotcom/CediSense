ALTER TABLE susu_groups ADD COLUMN variant TEXT NOT NULL DEFAULT 'rotating' CHECK(variant IN ('rotating', 'accumulating', 'goal_based', 'bidding', 'funeral_fund', 'school_fees', 'diaspora', 'event_fund', 'bulk_purchase', 'agricultural', 'welfare'));
ALTER TABLE susu_groups ADD COLUMN goal_amount_pesewas INTEGER;
ALTER TABLE susu_groups ADD COLUMN goal_description TEXT;
