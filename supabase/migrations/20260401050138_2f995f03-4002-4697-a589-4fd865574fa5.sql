-- Clean up stale pending suggestions where normalized values match
DELETE FROM public.extraction_suggestions 
WHERE status = 'pending' 
AND field_path IN ('clients.cpf', 'clients.rg', 'clients.address_zip')
AND REGEXP_REPLACE(COALESCE(current_value, ''), '[.\-\/\s]', '', 'g') = REGEXP_REPLACE(suggested_value, '[.\-\/\s]', '', 'g');