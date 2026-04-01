
CREATE TABLE public.client_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex') NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days' NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can manage sessions
CREATE POLICY "Admins can manage client_sessions" ON public.client_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anon can read by token (for magic link validation)
CREATE POLICY "Anon can read session by token" ON public.client_sessions
  FOR SELECT TO anon
  USING (true);
