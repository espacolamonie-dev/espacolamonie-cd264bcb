
ALTER TABLE public.mercado_pago_settings
ADD COLUMN client_id text NOT NULL DEFAULT '',
ADD COLUMN client_secret text NOT NULL DEFAULT '';
