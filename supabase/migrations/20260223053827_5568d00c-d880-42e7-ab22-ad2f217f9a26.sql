
-- Company settings table for persisting company data and financial preferences
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  cnpj TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  default_bank TEXT NOT NULL DEFAULT '',
  default_pix_key TEXT NOT NULL DEFAULT '',
  default_entry_category TEXT NOT NULL DEFAULT 'Aluguel extra',
  default_expense_category TEXT NOT NULL DEFAULT 'Outros',
  auto_receipt BOOLEAN NOT NULL DEFAULT false,
  auto_confirm_payment BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company settings"
ON public.company_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
