
ALTER TABLE public.feature_requests 
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tokens_awarded integer DEFAULT 0;

-- Allow admins to delete feature requests
CREATE POLICY "Admins can delete all requests"
  ON public.feature_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow users to update their own requests (for confirmation)
CREATE POLICY "Users can update own requests"
  ON public.feature_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
