ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_date DATE,
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT '';

-- Marca despesas antigas sem due_date como pagas (eram lançamentos diretos)
UPDATE public.expenses
SET paid = true, paid_date = date
WHERE due_date IS NULL AND paid = false;

CREATE INDEX IF NOT EXISTS idx_expenses_paid ON public.expenses(user_id, paid);
CREATE INDEX IF NOT EXISTS idx_expenses_employee ON public.expenses(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_parent ON public.expenses(parent_expense_id) WHERE parent_expense_id IS NOT NULL;