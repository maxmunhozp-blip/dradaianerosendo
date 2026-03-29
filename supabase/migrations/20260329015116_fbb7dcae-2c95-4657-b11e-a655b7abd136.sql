
CREATE OR REPLACE FUNCTION public.auto_link_client_on_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only run when user_id was previously null
  IF NEW.user_id IS NULL THEN
    UPDATE public.clients
    SET user_id = NEW.id
    WHERE email = NEW.email
      AND user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
