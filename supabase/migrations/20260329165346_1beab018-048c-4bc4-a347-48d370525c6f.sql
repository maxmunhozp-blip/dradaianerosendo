
-- Function to list users with their roles (security definer to access auth.users)
CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id as user_id,
    au.email::text,
    au.created_at,
    au.last_sign_in_at,
    COALESCE(ur.role::text, 'sem_role') as role
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON ur.user_id = au.id
  ORDER BY au.created_at DESC;
$$;

-- Function to set a user's role (admin only)
CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar permissões';
  END IF;
  
  -- Delete existing role
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  -- Insert new role
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _role);
END;
$$;

-- Function to remove a user's role (admin only)
CREATE OR REPLACE FUNCTION public.remove_user_role(_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar permissões';
  END IF;
  
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
END;
$$;
