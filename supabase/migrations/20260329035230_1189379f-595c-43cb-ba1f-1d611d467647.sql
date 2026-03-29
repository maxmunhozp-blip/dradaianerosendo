
-- Add RLS policies for storage.objects on case-documents bucket
CREATE POLICY "Authenticated users can upload to case-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'case-documents');

CREATE POLICY "Authenticated users can view case-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'case-documents');

CREATE POLICY "Authenticated users can update case-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'case-documents')
WITH CHECK (bucket_id = 'case-documents');

CREATE POLICY "Authenticated users can delete case-documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'case-documents');
