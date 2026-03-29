ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound';

UPDATE public.email_messages 
SET category = 'financial' 
WHERE email_account_id IN (
  SELECT id FROM public.email_accounts WHERE label ILIKE '%financeiro%' OR email ILIKE '%financeiro%'
) AND category = 'other';