
-- Add new fields to visits table
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS event_type_desired text NOT NULL DEFAULT '';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS event_value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL DEFAULT NULL;

-- Add visit_id and source to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL DEFAULT NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT '';
