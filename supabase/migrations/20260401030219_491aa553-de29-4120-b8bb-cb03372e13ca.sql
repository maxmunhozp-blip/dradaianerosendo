
CREATE TABLE public.document_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Padrão',
  logo_url text,
  letterhead_image_url text,
  header_text text,
  footer_text text,
  primary_color text DEFAULT '#1E3A5F',
  secondary_color text DEFAULT '#2B9E8F',
  font_family text DEFAULT 'Arial',
  font_size_body integer DEFAULT 12,
  font_size_heading integer DEFAULT 14,
  margin_top integer DEFAULT 30,
  margin_bottom integer DEFAULT 25,
  margin_left integer DEFAULT 30,
  margin_right integer DEFAULT 20,
  email_signature_html text,
  is_default boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.document_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document_branding"
  ON public.document_branding FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
