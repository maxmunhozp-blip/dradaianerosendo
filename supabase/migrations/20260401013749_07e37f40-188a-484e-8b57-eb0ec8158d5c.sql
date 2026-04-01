-- Fix search_path for validation functions
CREATE OR REPLACE FUNCTION validate_extraction_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.extraction_status NOT IN ('pending', 'processing', 'done', 'failed') THEN
    RAISE EXCEPTION 'Invalid extraction_status: %', NEW.extraction_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_extraction_confidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.extraction_confidence NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid extraction_confidence: %', NEW.extraction_confidence;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_suggestion_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid suggestion status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert suggestions" ON extraction_suggestions;
DROP POLICY IF EXISTS "Authenticated users can update suggestions" ON extraction_suggestions;
DROP POLICY IF EXISTS "Authenticated users can delete suggestions" ON extraction_suggestions;

-- Create proper RLS policies using has_role
CREATE POLICY "Admin users can insert suggestions"
  ON extraction_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin users can update suggestions"
  ON extraction_suggestions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin users can delete suggestions"
  ON extraction_suggestions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));