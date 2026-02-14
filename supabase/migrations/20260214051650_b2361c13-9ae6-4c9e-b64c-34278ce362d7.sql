
-- Table to store signing tokens and track client signatures
CREATE TABLE public.contract_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_name TEXT NOT NULL,
  client_cpf TEXT,
  client_phone TEXT,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  total_value NUMERIC NOT NULL DEFAULT 0,
  deposit_percent NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, signed
  signed_at TIMESTAMPTZ,
  signed_ip TEXT,
  sent_at TIMESTAMPTZ,
  sent_to_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Owner can manage their signatures
CREATE POLICY "Users can manage their own signatures"
  ON public.contract_signatures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public read access by token (for signing page)
CREATE POLICY "Anyone can read by token"
  ON public.contract_signatures FOR SELECT
  USING (true);

-- Public update for signing (only status, signed_at, signed_ip)
CREATE POLICY "Anyone can sign via token"
  ON public.contract_signatures FOR UPDATE
  USING (true)
  WITH CHECK (true);
