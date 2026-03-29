
DROP FUNCTION IF EXISTS public.auto_link_client_on_login();

CREATE OR REPLACE FUNCTION public.link_client_by_email(_user_id uuid, _email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
  SET user_id = _user_id
  WHERE email = _email
    AND user_id IS NULL;
END;
$$;
