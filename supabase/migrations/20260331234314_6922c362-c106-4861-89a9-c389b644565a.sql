
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS payment_choice text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_method_selected text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS payment_followup_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.contract_signatures
  ADD COLUMN IF NOT EXISTS payment_choice text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_method_selected text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_due_date text;
