-- Agricultural Crop Season Susu variant
ALTER TABLE susu_groups ADD COLUMN crop_type TEXT;
ALTER TABLE susu_groups ADD COLUMN planting_month INTEGER;
ALTER TABLE susu_groups ADD COLUMN harvest_month INTEGER;
