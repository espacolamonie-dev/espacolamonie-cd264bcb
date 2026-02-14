
-- Create signature audit logs table (immutable legal record)
CREATE TABLE public.signature_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id),
  client_name TEXT NOT NULL,
  client_cpf TEXT,
  signed_file_name TEXT NOT NULL,
  signature_type TEXT NOT NULL DEFAULT 'rubrica_manual',
  signed_at TIMESTAMPTZ NOT NULL,
  read_confirmed BOOLEAN NOT NULL DEFAULT true,
  signer_ip TEXT,
  device_type TEXT,
  operating_system TEXT,
  browser TEXT,
  user_agent TEXT,
  pdf_hash TEXT,
  contract_version INTEGER NOT NULL DEFAULT 1,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signature_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only the contract owner can read logs (admin = contract owner in this single-user CRM)
CREATE POLICY "Owner can view audit logs"
  ON public.signature_audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- No insert/update/delete via client — only service role (edge function) can write
-- RLS denies all writes from anon/authenticated by default since no INSERT/UPDATE/DELETE policies exist
