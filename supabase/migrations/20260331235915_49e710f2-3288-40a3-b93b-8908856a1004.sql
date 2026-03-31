
-- Add personal/address fields to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_street text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_complement text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_neighborhood text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_state text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_zip text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'brasileiro(a)';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS marital_status text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS profession text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS rg text;

-- Add children and opposing party fields to cases
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS children jsonb;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS opposing_party_name text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS opposing_party_cpf text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS opposing_party_address text;
