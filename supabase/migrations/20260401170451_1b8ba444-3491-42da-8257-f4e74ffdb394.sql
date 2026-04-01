
CREATE TABLE public.permission_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'User',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
ON public.permission_profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage profiles"
ON public.permission_profiles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_permission_profiles_updated_at
BEFORE UPDATE ON public.permission_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed built-in profiles
INSERT INTO public.permission_profiles (name, description, icon, is_builtin, permissions) VALUES
('Advogado', 'Acesso total a casos, clientes e documentos', 'Briefcase', true, '{"can_view_cases":true,"can_edit_cases":true,"can_view_clients":true,"can_edit_clients":true,"can_view_documents":true,"can_edit_documents":true,"can_access_settings":false}'),
('Estagiário', 'Apenas visualização de casos e documentos', 'GraduationCap', true, '{"can_view_cases":true,"can_edit_cases":false,"can_view_clients":true,"can_edit_clients":false,"can_view_documents":true,"can_edit_documents":false,"can_access_settings":false}'),
('Financeiro', 'Acesso a clientes e documentos, sem casos', 'Calculator', true, '{"can_view_cases":false,"can_edit_cases":false,"can_view_clients":true,"can_edit_clients":true,"can_view_documents":true,"can_edit_documents":true,"can_access_settings":false}'),
('Secretária', 'Gerencia clientes e agenda, sem editar casos', 'ClipboardList', true, '{"can_view_cases":true,"can_edit_cases":false,"can_view_clients":true,"can_edit_clients":true,"can_view_documents":true,"can_edit_documents":false,"can_access_settings":false}'),
('Perito', 'Visualiza casos e documentos atribuídos', 'Search', true, '{"can_view_cases":true,"can_edit_cases":false,"can_view_clients":false,"can_edit_clients":false,"can_view_documents":true,"can_edit_documents":true,"can_access_settings":false}');
