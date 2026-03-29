
-- Add provider and IMAP fields to email_accounts
ALTER TABLE public.email_accounts 
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'gmail',
  ADD COLUMN IF NOT EXISTS imap_host text,
  ADD COLUMN IF NOT EXISTS imap_port integer,
  ADD COLUMN IF NOT EXISTS imap_user text,
  ADD COLUMN IF NOT EXISTS imap_password text;

-- Create email_messages table
CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email_account_id uuid REFERENCES public.email_accounts(id) ON DELETE CASCADE NOT NULL,
  message_uid text NOT NULL,
  from_email text,
  from_name text,
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  body_html text,
  received_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  is_judicial boolean NOT NULL DEFAULT false,
  intimacao_id uuid REFERENCES public.intimacoes(id) ON DELETE SET NULL,
  UNIQUE(email_account_id, message_uid)
);

-- Enable RLS
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Admin policy
CREATE POLICY "Admins can manage email_messages"
  ON public.email_messages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
