ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS parent_expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS total_installments integer;

CREATE INDEX IF NOT EXISTS idx_expenses_parent ON public.expenses(parent_expense_id);
CREATE INDEX IF NOT EXISTS idx_expenses_due_date ON public.expenses(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_expenses_is_fixed ON public.expenses(user_id, is_fixed);