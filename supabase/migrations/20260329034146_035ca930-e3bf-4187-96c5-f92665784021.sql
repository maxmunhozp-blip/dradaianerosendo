
CREATE TABLE public.hearings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'agendado',
  alert_whatsapp BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.hearings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with hearings"
ON public.hearings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own hearings"
ON public.hearings FOR SELECT TO authenticated
USING (case_id IN (
  SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()
));
