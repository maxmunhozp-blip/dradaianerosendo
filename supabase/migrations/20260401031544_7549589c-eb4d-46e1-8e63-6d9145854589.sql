-- Add signature columns to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS signature_doc_token TEXT,
  ADD COLUMN IF NOT EXISTS signers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS signature_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMPTZ;

-- Validation trigger for signature_status
CREATE OR REPLACE FUNCTION public.validate_signature_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.signature_status NOT IN ('none', 'sent', 'signed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid signature_status: %', NEW.signature_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_signature_status_trigger
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION validate_signature_status();

-- Ensure signature_api_token setting exists
INSERT INTO settings (key, value) VALUES ('signature_api_token', '') ON CONFLICT (key) DO NOTHING;