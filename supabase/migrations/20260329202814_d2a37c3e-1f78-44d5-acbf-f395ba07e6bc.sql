ALTER TABLE public.email_accounts 
ADD COLUMN IF NOT EXISTS sync_limit integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS sync_subject_filters jsonb DEFAULT '["intimação","citação","despacho","sentença","decisão","mandado","notificação","audiência","prazo"]'::jsonb,
ADD COLUMN IF NOT EXISTS sync_judicial_only boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_extra_senders text DEFAULT '',
ADD COLUMN IF NOT EXISTS sync_attachments boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_attachments_pdf_only boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_period_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS sync_configured boolean DEFAULT false;