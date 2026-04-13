
-- Mercado Pago settings table
CREATE TABLE public.mercado_pago_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token text NOT NULL DEFAULT '',
  public_key text NOT NULL DEFAULT '',
  success_url text NOT NULL DEFAULT '',
  failure_url text NOT NULL DEFAULT '',
  pending_url text NOT NULL DEFAULT '',
  webhook_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mercado_pago_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mp settings" ON public.mercado_pago_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add MP fields to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS mp_preference_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_payment_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_external_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_payment_status text NOT NULL DEFAULT '';

-- Mercado Pago payment logs for audit
CREATE TABLE public.mp_payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  mp_payment_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mp_payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mp logs" ON public.mp_payment_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert mp logs" ON public.mp_payment_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
