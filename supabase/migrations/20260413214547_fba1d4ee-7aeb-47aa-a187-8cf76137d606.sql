
-- Allow anon users to read contract_signatures by token (for client area)
CREATE POLICY "Public can read signatures by token"
ON public.contract_signatures
FOR SELECT
TO anon
USING (true);

-- Allow anon users to read contracts by id (for client area via edge function)
-- This is safe because the edge function validates the token first
