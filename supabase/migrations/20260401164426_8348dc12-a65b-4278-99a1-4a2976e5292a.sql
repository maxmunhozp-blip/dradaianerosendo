
-- 1. Add 'advogado' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'advogado';

-- 2. Create user_plans table
CREATE TABLE public.user_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'basic',
  status text NOT NULL DEFAULT 'active',
  promo_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all plans"
  ON public.user_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own plan"
  ON public.user_plans FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Add owner_id to data tables
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.hearings ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.case_timeline ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.intimacoes ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 4. Seed existing data with first admin's id
DO $$
DECLARE
  _admin_id uuid;
BEGIN
  SELECT user_id INTO _admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF _admin_id IS NOT NULL THEN
    UPDATE public.clients SET owner_id = _admin_id WHERE owner_id IS NULL;
    UPDATE public.cases SET owner_id = _admin_id WHERE owner_id IS NULL;
    UPDATE public.documents SET owner_id = _admin_id WHERE owner_id IS NULL;
    UPDATE public.checklist_items SET owner_id = _admin_id WHERE owner_id IS NULL;
    UPDATE public.hearings SET owner_id = _admin_id WHERE owner_id IS NULL;
    UPDATE public.messages SET owner_id = _admin_id WHERE owner_id IS NULL;
    UPDATE public.case_timeline SET owner_id = _admin_id WHERE owner_id IS NULL;
    UPDATE public.intimacoes SET owner_id = _admin_id WHERE owner_id IS NULL;
  END IF;
END $$;

-- 5. Update RLS policies for multi-tenant isolation

-- CLIENTS
DROP POLICY IF EXISTS "Admins can do everything with clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view own record" ON public.clients;

CREATE POLICY "Admins full access clients"
  ON public.clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own clients"
  ON public.clients FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own record"
  ON public.clients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- CASES
DROP POLICY IF EXISTS "Admins can do everything with cases" ON public.cases;
DROP POLICY IF EXISTS "Clients can view own cases" ON public.cases;

CREATE POLICY "Admins full access cases"
  ON public.cases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own cases"
  ON public.cases FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own cases"
  ON public.cases FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- DOCUMENTS
DROP POLICY IF EXISTS "Admins can do everything with documents" ON public.documents;
DROP POLICY IF EXISTS "Clients can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Clients can upload documents to own cases" ON public.documents;

CREATE POLICY "Admins full access documents"
  ON public.documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own documents"
  ON public.documents FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own documents"
  ON public.documents FOR SELECT TO authenticated
  USING (case_id IN (SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()));

CREATE POLICY "Clients upload own documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = 'cliente' AND case_id IN (SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()));

-- CHECKLIST_ITEMS
DROP POLICY IF EXISTS "Admins can do everything with checklist" ON public.checklist_items;
DROP POLICY IF EXISTS "Clients can view own checklist" ON public.checklist_items;

CREATE POLICY "Admins full access checklist"
  ON public.checklist_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own checklist"
  ON public.checklist_items FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own checklist"
  ON public.checklist_items FOR SELECT TO authenticated
  USING (case_id IN (SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()));

-- HEARINGS
DROP POLICY IF EXISTS "Admins can do everything with hearings" ON public.hearings;
DROP POLICY IF EXISTS "Clients can view own hearings" ON public.hearings;

CREATE POLICY "Admins full access hearings"
  ON public.hearings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own hearings"
  ON public.hearings FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own hearings"
  ON public.hearings FOR SELECT TO authenticated
  USING (case_id IN (SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()));

-- MESSAGES
DROP POLICY IF EXISTS "Admins can do everything with messages" ON public.messages;
DROP POLICY IF EXISTS "Clients can view own messages" ON public.messages;

CREATE POLICY "Admins full access messages"
  ON public.messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own messages"
  ON public.messages FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (case_id IN (SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()));

-- CASE_TIMELINE
DROP POLICY IF EXISTS "Admins can do everything with case_timeline" ON public.case_timeline;
DROP POLICY IF EXISTS "Clients can view own case timeline" ON public.case_timeline;

CREATE POLICY "Admins full access case_timeline"
  ON public.case_timeline FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own case_timeline"
  ON public.case_timeline FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own case_timeline"
  ON public.case_timeline FOR SELECT TO authenticated
  USING (case_id IN (SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()));

-- INTIMACOES
DROP POLICY IF EXISTS "Admins can do everything with intimacoes" ON public.intimacoes;
DROP POLICY IF EXISTS "Clients can view own intimacoes" ON public.intimacoes;

CREATE POLICY "Admins full access intimacoes"
  ON public.intimacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advogados own intimacoes"
  ON public.intimacoes FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Clients view own intimacoes"
  ON public.intimacoes FOR SELECT TO authenticated
  USING (case_id IN (SELECT c.id FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE cl.user_id = auth.uid()));

-- 6. Function to auto-set owner_id on insert
CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_clients_owner BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER set_cases_owner BEFORE INSERT ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER set_documents_owner BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER set_checklist_owner BEFORE INSERT ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER set_hearings_owner BEFORE INSERT ON public.hearings FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER set_messages_owner BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER set_timeline_owner BEFORE INSERT ON public.case_timeline FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER set_intimacoes_owner BEFORE INSERT ON public.intimacoes FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- 7. Update handle_new_user to support advogado role for self-registered users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _user_count int;
BEGIN
  SELECT COUNT(*) INTO _user_count FROM public.user_roles;
  
  IF _user_count = 0 THEN
    _role := 'admin';
  ELSE
    _role := 'advogado';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 8. Update handle_new_user_permissions for advogado
CREATE OR REPLACE FUNCTION public.handle_new_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id, can_view_cases, can_edit_cases, can_view_clients, can_edit_clients, can_view_documents, can_edit_documents, can_access_settings)
  VALUES (
    NEW.user_id,
    CASE WHEN NEW.role IN ('admin', 'advogado') THEN true ELSE false END,
    CASE WHEN NEW.role IN ('admin', 'advogado') THEN true ELSE false END,
    CASE WHEN NEW.role IN ('admin', 'advogado') THEN true ELSE false END,
    CASE WHEN NEW.role IN ('admin', 'advogado') THEN true ELSE false END,
    CASE WHEN NEW.role IN ('admin', 'advogado') THEN true ELSE false END,
    CASE WHEN NEW.role IN ('admin', 'advogado') THEN true ELSE false END,
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
