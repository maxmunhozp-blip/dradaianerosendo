
CREATE TABLE public.data_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  fields_requested jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  completed_at timestamp with time zone
);

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage data_requests"
  ON public.data_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read own data_request by token"
  ON public.data_requests FOR SELECT TO anon
  USING (status = 'pending' AND expires_at > now());
