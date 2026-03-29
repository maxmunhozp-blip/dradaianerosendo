
CREATE TABLE public.case_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'automatic')),
  status TEXT NOT NULL DEFAULT 'atualização_recebida',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  responsible TEXT,
  source_email_id UUID REFERENCES public.email_messages(id),
  pinned BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE public.case_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with case_timeline"
  ON public.case_timeline FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own case timeline"
  ON public.case_timeline FOR SELECT TO authenticated
  USING (case_id IN (
    SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.update_case_timeline_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER case_timeline_updated_at
  BEFORE UPDATE ON public.case_timeline
  FOR EACH ROW EXECUTE FUNCTION update_case_timeline_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.case_timeline;
