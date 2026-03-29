ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS sync_financial boolean DEFAULT false;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS sync_extra_domains text DEFAULT '';
ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';