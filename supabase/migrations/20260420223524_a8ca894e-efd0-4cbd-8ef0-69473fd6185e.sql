CREATE TABLE public.cash_balance_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_balance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash adjustments"
ON public.cash_balance_adjustments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash adjustments"
ON public.cash_balance_adjustments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cash adjustments"
ON public.cash_balance_adjustments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cash adjustments"
ON public.cash_balance_adjustments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_cash_balance_user_date ON public.cash_balance_adjustments(user_id, adjustment_date DESC);