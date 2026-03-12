
-- Make contract_id nullable on contract_signatures
ALTER TABLE public.contract_signatures ALTER COLUMN contract_id DROP NOT NULL;

-- Add budget_id column
ALTER TABLE public.contract_signatures ADD COLUMN budget_id uuid REFERENCES public.budgets(id) ON DELETE CASCADE DEFAULT NULL;
