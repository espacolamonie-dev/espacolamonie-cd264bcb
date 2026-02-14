
-- Add client_address to contract_signatures for full contract display on signing page
ALTER TABLE public.contract_signatures 
ADD COLUMN IF NOT EXISTS client_address text DEFAULT '';
