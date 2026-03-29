
-- Allow clients to INSERT documents on their own cases
CREATE POLICY "Clients can upload documents to own cases"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = 'cliente'
  AND case_id IN (
    SELECT c.id FROM cases c
    JOIN clients cl ON c.client_id = cl.id
    WHERE cl.user_id = auth.uid()
  )
);

-- Allow clients to upload files to storage bucket
CREATE POLICY "Clients can upload to own case folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text FROM cases c
    JOIN clients cl ON c.client_id = cl.id
    WHERE cl.user_id = auth.uid()
  )
);

-- Allow clients to read own case files from storage
CREATE POLICY "Clients can read own case files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'case-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text FROM cases c
    JOIN clients cl ON c.client_id = cl.id
    WHERE cl.user_id = auth.uid()
  )
);
