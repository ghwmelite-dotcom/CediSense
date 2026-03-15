ALTER TABLE susu_groups ADD COLUMN variant TEXT NOT NULL DEFAULT 'rotating' CHECK(variant IN ('rotating', 'accumulating', 'goal_based', 'bidding'));
ALTER TABLE susu_groups ADD COLUMN goal_amount_pesewas INTEGER;
ALTER TABLE susu_groups ADD COLUMN goal_description TEXT;
