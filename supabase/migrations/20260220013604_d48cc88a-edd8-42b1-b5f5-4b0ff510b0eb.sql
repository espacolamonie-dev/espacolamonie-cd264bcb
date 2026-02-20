
-- Create visits table
CREATE TABLE public.visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  interest_event_date DATE,
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Agendada',
  google_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own visits"
  ON public.visits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own visits"
  ON public.visits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visits"
  ON public.visits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own visits"
  ON public.visits FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_visits_updated_at();
