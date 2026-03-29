
-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Only admins can read user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  origin TEXT,
  status TEXT NOT NULL DEFAULT 'prospect',
  notes TEXT DEFAULT ''
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own record"
  ON public.clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Cases table
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  case_type TEXT NOT NULL,
  cnj_number TEXT,
  court TEXT,
  status TEXT NOT NULL DEFAULT 'documentacao',
  description TEXT DEFAULT ''
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- 4. Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outro',
  status TEXT NOT NULL DEFAULT 'solicitado',
  file_url TEXT DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT 'advogada',
  notes TEXT DEFAULT ''
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with documents"
  ON public.documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    case_id IN (
      SELECT c.id FROM public.cases c
      JOIN public.clients cl ON c.client_id = cl.id
      WHERE cl.user_id = auth.uid()
    )
  );

-- 5. Checklist items table
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  required_by TEXT
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with checklist"
  ON public.checklist_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own checklist"
  ON public.checklist_items FOR SELECT
  TO authenticated
  USING (
    case_id IN (
      SELECT c.id FROM public.cases c
      JOIN public.clients cl ON c.client_id = cl.id
      WHERE cl.user_id = auth.uid()
    )
  );

-- 6. Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with messages"
  ON public.messages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    case_id IN (
      SELECT c.id FROM public.cases c
      JOIN public.clients cl ON c.client_id = cl.id
      WHERE cl.user_id = auth.uid()
    )
  );

-- 7. Storage bucket for case documents
INSERT INTO storage.buckets (id, name, public) VALUES ('case-documents', 'case-documents', false);

CREATE POLICY "Admins can upload case documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'case-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all case documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'case-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete case documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'case-documents' AND public.has_role(auth.uid(), 'admin'));

-- 8. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
