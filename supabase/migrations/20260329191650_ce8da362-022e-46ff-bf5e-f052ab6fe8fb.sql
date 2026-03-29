ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_host text DEFAULT NULL;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT NULL;