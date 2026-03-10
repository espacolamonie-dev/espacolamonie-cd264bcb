
CREATE TABLE public.booking_schedule_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  allowed_days integer[] NOT NULL DEFAULT '{2,4}',
  start_hour integer NOT NULL DEFAULT 9,
  end_hour integer NOT NULL DEFAULT 20,
  blocked_hours integer[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own booking schedule"
  ON public.booking_schedule_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read booking schedule"
  ON public.booking_schedule_settings
  FOR SELECT
  TO anon
  USING (true);
