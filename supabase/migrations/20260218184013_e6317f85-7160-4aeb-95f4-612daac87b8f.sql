
-- Add google_event_id to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS google_event_id TEXT DEFAULT NULL;

-- Create google_settings table to store OAuth tokens per user
CREATE TABLE IF NOT EXISTS public.google_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT DEFAULT 'primary',
  calendar_name TEXT DEFAULT 'primary',
  connected_at TIMESTAMP WITH TIME ZONE,
  connected_email TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own google settings"
ON public.google_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create google_sync_logs table for debugging
CREATE TABLE IF NOT EXISTS public.google_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contract_id UUID,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  message TEXT,
  google_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
ON public.google_sync_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert sync logs"
ON public.google_sync_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update trigger for google_settings
CREATE OR REPLACE FUNCTION public.update_google_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_google_settings_updated_at
BEFORE UPDATE ON public.google_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_google_settings_updated_at();
