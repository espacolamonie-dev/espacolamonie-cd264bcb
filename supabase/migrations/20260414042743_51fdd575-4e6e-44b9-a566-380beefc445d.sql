
CREATE TABLE public.key_delivery_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  client_name text NOT NULL,
  client_cpf text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT '',
  event_date date NOT NULL,
  event_time text NOT NULL DEFAULT '',
  delivery_datetime timestamp with time zone NOT NULL DEFAULT now(),
  signature_image text,
  rubric_image text,
  pdf_url text,
  status text NOT NULL DEFAULT 'pending',
  signed_at timestamp with time zone,
  signed_ip text,
  user_agent text,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.key_delivery_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own key delivery terms"
ON public.key_delivery_terms
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read key delivery terms by token"
ON public.key_delivery_terms
FOR SELECT
TO anon
USING (true);
