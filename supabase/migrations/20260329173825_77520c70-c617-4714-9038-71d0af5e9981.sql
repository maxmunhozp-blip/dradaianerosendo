CREATE TABLE public.intimacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  raw_email_subject TEXT NOT NULL DEFAULT '',
  raw_email_body TEXT NOT NULL DEFAULT '',
  raw_email_date TIMESTAMP WITH TIME ZONE,
  from_email TEXT,
  process_number TEXT,
  tribunal TEXT,
  movement_type TEXT,
  deadline_date DATE,
  status TEXT NOT NULL DEFAULT 'novo',
  notes TEXT,
  gmail_message_id TEXT,
  ai_summary TEXT
);

ALTER TABLE public.intimacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with intimacoes"
  ON public.intimacoes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own intimacoes"
  ON public.intimacoes FOR SELECT
  TO authenticated
  USING (case_id IN (
    SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()
  ));

CREATE INDEX idx_intimacoes_status ON public.intimacoes(status);
CREATE INDEX idx_intimacoes_case_id ON public.intimacoes(case_id);
CREATE INDEX idx_intimacoes_process_number ON public.intimacoes(process_number);
CREATE UNIQUE INDEX idx_intimacoes_gmail_message_id ON public.intimacoes(gmail_message_id) WHERE gmail_message_id IS NOT NULL;