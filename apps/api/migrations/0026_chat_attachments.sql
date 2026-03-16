-- Add attachment support to susu_messages
ALTER TABLE susu_messages ADD COLUMN attachment_key TEXT;
ALTER TABLE susu_messages ADD COLUMN attachment_type TEXT;
ALTER TABLE susu_messages ADD COLUMN attachment_name TEXT;
ALTER TABLE susu_messages ADD COLUMN attachment_size INTEGER;
