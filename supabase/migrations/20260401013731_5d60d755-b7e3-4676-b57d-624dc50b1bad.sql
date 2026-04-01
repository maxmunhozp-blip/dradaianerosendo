-- Add extraction columns to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extraction_confidence TEXT DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

-- Create extraction_suggestions table
CREATE TABLE IF NOT EXISTS extraction_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  suggested_value TEXT NOT NULL,
  current_value TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create validation trigger for extraction_status
CREATE OR REPLACE FUNCTION validate_extraction_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.extraction_status NOT IN ('pending', 'processing', 'done', 'failed') THEN
    RAISE EXCEPTION 'Invalid extraction_status: %', NEW.extraction_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_extraction_status
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION validate_extraction_status();

-- Create validation trigger for extraction_confidence
CREATE OR REPLACE FUNCTION validate_extraction_confidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.extraction_confidence NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid extraction_confidence: %', NEW.extraction_confidence;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_extraction_confidence
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION validate_extraction_confidence();

-- Create validation trigger for suggestion status
CREATE OR REPLACE FUNCTION validate_suggestion_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid suggestion status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_suggestion_status
  BEFORE INSERT OR UPDATE ON extraction_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION validate_suggestion_status();

-- RLS for extraction_suggestions
ALTER TABLE extraction_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suggestions"
  ON extraction_suggestions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert suggestions"
  ON extraction_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update suggestions"
  ON extraction_suggestions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete suggestions"
  ON extraction_suggestions FOR DELETE
  TO authenticated
  USING (true);