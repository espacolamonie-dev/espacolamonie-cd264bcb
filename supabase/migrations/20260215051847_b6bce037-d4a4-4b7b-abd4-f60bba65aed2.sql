
-- Fix 1: Remove the broad public read policy on contract_signatures
-- The edge function uses service_role key and doesn't need public RLS access
DROP POLICY IF EXISTS "Anyone can read by token" ON public.contract_signatures;

-- Fix 2: Ensure clients table policies are PERMISSIVE (not RESTRICTIVE) for proper RLS behavior
-- Drop and recreate as PERMISSIVE to ensure only authenticated owners can access
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;

CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix 3: Same for expenses table
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Also fix contract_signatures: ensure proper permissive policies for authenticated owners
DROP POLICY IF EXISTS "Read own signatures" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can manage their own signatures" ON public.contract_signatures;

CREATE POLICY "Users can manage their own signatures" ON public.contract_signatures FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Keep the restricted update policy for public signing (token-based via edge function handles auth)
-- The "Sign via token restricted" policy stays as-is for the edge function's service role
