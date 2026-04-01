
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  can_view_cases boolean NOT NULL DEFAULT false,
  can_edit_cases boolean NOT NULL DEFAULT false,
  can_view_clients boolean NOT NULL DEFAULT false,
  can_edit_clients boolean NOT NULL DEFAULT false,
  can_view_documents boolean NOT NULL DEFAULT false,
  can_edit_documents boolean NOT NULL DEFAULT false,
  can_access_settings boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_permissions"
  ON public.user_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Auto-create permissions row when user_roles is inserted
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
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END,
    CASE WHEN NEW.role = 'admin' THEN true ELSE false END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_role_created
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_permissions();

-- Seed permissions for existing users
INSERT INTO public.user_permissions (user_id, can_view_cases, can_edit_cases, can_view_clients, can_edit_clients, can_view_documents, can_edit_documents, can_access_settings)
SELECT ur.user_id,
  ur.role = 'admin', ur.role = 'admin',
  ur.role = 'admin', ur.role = 'admin',
  ur.role = 'admin', ur.role = 'admin',
  ur.role = 'admin'
FROM public.user_roles ur
ON CONFLICT (user_id) DO NOTHING;
