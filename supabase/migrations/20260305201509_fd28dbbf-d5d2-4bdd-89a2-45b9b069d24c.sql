ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS rental_type text NOT NULL DEFAULT 'Locação (1 dia)';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS event_date_end date;