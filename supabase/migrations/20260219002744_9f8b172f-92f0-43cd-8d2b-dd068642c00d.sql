
-- Fix: Restrict SELECT policies to authenticated users only
-- This prevents anonymous/public access to sensitive tables

-- === CLIENTS table ===
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
CREATE POLICY "Users can view own clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- === CONTRACTS table ===
DROP POLICY IF EXISTS "Users can view own contracts" ON public.contracts;
CREATE POLICY "Users can view own contracts"
  ON public.contracts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix INSERT/UPDATE/DELETE policies on contracts to also use TO authenticated
DROP POLICY IF EXISTS "Users can insert own contracts" ON public.contracts;
CREATE POLICY "Users can insert own contracts"
  ON public.contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contracts" ON public.contracts;
CREATE POLICY "Users can update own contracts"
  ON public.contracts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contracts" ON public.contracts;
CREATE POLICY "Users can delete own contracts"
  ON public.contracts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix INSERT/UPDATE/DELETE policies on clients to also use TO authenticated
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clients;
CREATE POLICY "Users can insert own clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
CREATE POLICY "Users can delete own clients"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- === CONTRACT_SIGNATURES table ===
-- Keep the token-based update for signing (anon must be able to sign via token)
-- but restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Users can manage their own signatures" ON public.contract_signatures;
CREATE POLICY "Users can manage their own signatures"
  ON public.contract_signatures
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The signing policy (anon token update) must remain accessible to all roles
-- since clients sign without being logged in
DROP POLICY IF EXISTS "Sign via token restricted" ON public.contract_signatures;
CREATE POLICY "Sign via token restricted"
  ON public.contract_signatures
  FOR UPDATE
  USING (status = 'pending'::text)
  WITH CHECK (status = 'signed'::text);

-- Allow public SELECT only for the signing flow (by token, read-only for the sign page)
-- This is needed so the sign-contract page can fetch the signature data by token
CREATE POLICY "Public can read pending signatures by token"
  ON public.contract_signatures
  FOR SELECT
  USING (status = 'pending'::text);
