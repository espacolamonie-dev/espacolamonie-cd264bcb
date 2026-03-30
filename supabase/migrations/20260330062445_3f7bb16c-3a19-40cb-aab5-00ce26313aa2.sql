
-- Employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  roles TEXT[] NOT NULL DEFAULT '{}',
  payment_value NUMERIC NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'por_contrato',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Employee payments table
CREATE TABLE public.employee_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own employee payments"
  ON public.employee_payments FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
