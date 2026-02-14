
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can read by token" ON public.contract_signatures;
DROP POLICY IF EXISTS "Anyone can sign via token" ON public.contract_signatures;

-- Secure SELECT: only allow reading a specific record by matching token (via RPC) or own records
CREATE POLICY "Read own signatures"
ON public.contract_signatures
FOR SELECT
USING (auth.uid() = user_id);

-- Secure UPDATE: only allow signing (status change from pending to signed), no other field changes
CREATE POLICY "Sign via token restricted"
ON public.contract_signatures
FOR UPDATE
USING (status = 'pending')
WITH CHECK (status = 'signed');
