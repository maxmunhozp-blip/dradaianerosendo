DELETE FROM public.extraction_suggestions a
USING public.extraction_suggestions b
WHERE a.id < b.id
  AND a.field_path = b.field_path
  AND a.case_id = b.case_id;

ALTER TABLE public.extraction_suggestions ADD CONSTRAINT unique_field_per_case UNIQUE (field_path, case_id);