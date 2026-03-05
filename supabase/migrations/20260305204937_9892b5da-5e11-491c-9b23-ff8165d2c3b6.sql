ALTER TABLE public.contract_signatures ADD COLUMN rental_type text DEFAULT 'Locação (1 dia)';
ALTER TABLE public.contract_signatures ADD COLUMN event_date_end text DEFAULT null;