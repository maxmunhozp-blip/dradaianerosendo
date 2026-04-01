
ALTER TABLE public.data_requests ADD COLUMN fields_requested_new TEXT[] DEFAULT '{}';

UPDATE public.data_requests SET fields_requested_new = COALESCE(
  ARRAY(SELECT jsonb_array_elements_text(fields_requested::jsonb)),
  '{}'
) WHERE fields_requested IS NOT NULL;

ALTER TABLE public.data_requests DROP COLUMN fields_requested;
ALTER TABLE public.data_requests RENAME COLUMN fields_requested_new TO fields_requested;
