
CREATE TABLE public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  label TEXT NOT NULL,
  email TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'Todos',
  status TEXT NOT NULL DEFAULT 'desconectado',
  last_sync TIMESTAMP WITH TIME ZONE,
  access_token TEXT,
  refresh_token TEXT,
  gmail_message_id_cursor TEXT
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_accounts"
ON public.email_accounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
