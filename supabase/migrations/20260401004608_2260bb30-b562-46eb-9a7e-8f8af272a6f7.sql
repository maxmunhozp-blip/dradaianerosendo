
DROP POLICY IF EXISTS "Public can read own data_request by token" ON public.data_requests;

CREATE POLICY "Public can read data_request by token"
  ON public.data_requests FOR SELECT TO anon
  USING (true);
