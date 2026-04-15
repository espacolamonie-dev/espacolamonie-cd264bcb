
-- Add confirmation fields to visits
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS confirmation_slug text,
  ADD COLUMN IF NOT EXISTS confirmation_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_confirmation_slug ON public.visits(confirmation_slug) WHERE confirmation_slug IS NOT NULL;

-- Index on token
CREATE INDEX IF NOT EXISTS idx_visits_confirmation_token ON public.visits(confirmation_token) WHERE confirmation_token IS NOT NULL;

-- Allow anon to read visits by slug (for public confirmation page)
CREATE POLICY "Public can read visits by slug"
  ON public.visits
  FOR SELECT
  TO anon
  USING (confirmation_slug IS NOT NULL);

-- Allow anon to update visit status for confirmation
CREATE POLICY "Public can confirm visits by token"
  ON public.visits
  FOR UPDATE
  TO anon
  USING (confirmation_token IS NOT NULL)
  WITH CHECK (confirmation_token IS NOT NULL);
