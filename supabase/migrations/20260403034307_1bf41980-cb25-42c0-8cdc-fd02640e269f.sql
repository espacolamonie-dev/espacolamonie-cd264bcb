
ALTER TABLE public.contracts
ADD COLUMN reserved_until timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.contracts.reserved_until IS 'Data/hora limite da reserva temporária (24h após criação do contrato)';
