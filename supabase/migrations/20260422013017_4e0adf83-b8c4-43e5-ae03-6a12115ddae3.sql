CREATE TABLE IF NOT EXISTS public.webhook_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failure')),
  reason text,
  signature_header text,
  remote_ip text,
  payload_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_verification_log_created_at_idx
  ON public.webhook_verification_log (created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_verification_log_source_status_idx
  ON public.webhook_verification_log (source, status);

ALTER TABLE public.webhook_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook verification log"
  ON public.webhook_verification_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete webhook verification log"
  ON public.webhook_verification_log FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));