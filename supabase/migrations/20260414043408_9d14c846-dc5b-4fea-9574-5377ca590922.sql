
-- Event checkouts table
CREATE TABLE public.event_checkouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  client_name text NOT NULL,
  event_date date NOT NULL,
  event_time_contracted text NOT NULL DEFAULT '',
  checkout_time timestamp with time zone NOT NULL DEFAULT now(),
  delay_minutes integer NOT NULL DEFAULT 0,
  fine_amount numeric NOT NULL DEFAULT 0,
  fine_status text NOT NULL DEFAULT 'pending',
  checklist_clean boolean NOT NULL DEFAULT false,
  checklist_no_damage boolean NOT NULL DEFAULT false,
  checklist_trash boolean NOT NULL DEFAULT false,
  checklist_equipment boolean NOT NULL DEFAULT false,
  observations text NOT NULL DEFAULT '',
  client_signature text,
  staff_signature text,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.event_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own event checkouts"
ON public.event_checkouts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read event checkouts"
ON public.event_checkouts
FOR SELECT
TO anon
USING (true);

-- Add event_status to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS event_status text NOT NULL DEFAULT 'pending';
