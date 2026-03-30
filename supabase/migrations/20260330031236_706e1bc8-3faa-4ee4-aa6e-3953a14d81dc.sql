
-- Meta Pixel settings table
CREATE TABLE public.meta_pixel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pixel_enabled boolean NOT NULL DEFAULT false,
  capi_enabled boolean NOT NULL DEFAULT false,
  pixel_id text NOT NULL DEFAULT '',
  access_token text NOT NULL DEFAULT '',
  conversion_event text NOT NULL DEFAULT 'Lead',
  send_value boolean NOT NULL DEFAULT false,
  value_source text NOT NULL DEFAULT 'total',
  whatsapp_number text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_pixel_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meta pixel settings"
  ON public.meta_pixel_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Meta event logs table
CREATE TABLE public.meta_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_name text NOT NULL DEFAULT '',
  event_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meta event logs"
  ON public.meta_event_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
