
-- Add slug column to contract_signatures for friendly URLs
ALTER TABLE public.contract_signatures ADD COLUMN slug text;

-- Create unique index on slug (only for non-null values)
CREATE UNIQUE INDEX idx_contract_signatures_slug ON public.contract_signatures (slug) WHERE slug IS NOT NULL;
