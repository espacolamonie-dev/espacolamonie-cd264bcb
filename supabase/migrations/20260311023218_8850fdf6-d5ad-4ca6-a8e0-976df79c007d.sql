
CREATE TABLE public.daily_whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_date date NOT NULL,
  contact_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_date)
);

ALTER TABLE public.daily_whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily contacts"
  ON public.daily_whatsapp_contacts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
