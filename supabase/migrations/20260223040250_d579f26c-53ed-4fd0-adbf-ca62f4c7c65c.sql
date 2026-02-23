
-- WhatsApp connection settings (WAHA config)
CREATE TABLE public.whatsapp_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  waha_url text NOT NULL DEFAULT '',
  waha_api_key text NOT NULL DEFAULT '',
  session_name text NOT NULL DEFAULT 'default',
  status text NOT NULL DEFAULT 'disconnected',
  connected_phone text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_connection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own whatsapp connection"
  ON public.whatsapp_connection FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'in',
  body text NOT NULL DEFAULT '',
  timestamp timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own messages"
  ON public.whatsapp_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Stage automation rules
CREATE TABLE public.stage_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  auto_message_template_key text,
  auto_send boolean NOT NULL DEFAULT false,
  followup_after_hours integer,
  followup_template_key text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own automation rules"
  ON public.stage_automation_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- WhatsApp connection logs
CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'info',
  message text NOT NULL DEFAULT '',
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp logs"
  ON public.whatsapp_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp logs"
  ON public.whatsapp_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add human_mode to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS human_mode boolean NOT NULL DEFAULT false;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
