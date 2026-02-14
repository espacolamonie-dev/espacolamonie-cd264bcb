
-- Add structured address columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS address_street TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_complement TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_zip TEXT NOT NULL DEFAULT '';

-- Migrate existing address data to street field as best-effort
UPDATE public.clients SET address_street = address WHERE address != '' AND address_street = '';
