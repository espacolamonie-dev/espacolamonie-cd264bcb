
-- Add UTM attribution columns to visits
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS utm_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_medium text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_campaign text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_term text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fbclid text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_campaign_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_adset_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_ad_id text NOT NULL DEFAULT '';

-- Add UTM attribution columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS utm_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_medium text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_campaign text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_term text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fbclid text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_campaign_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_adset_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_ad_id text NOT NULL DEFAULT '';

-- Add UTM attribution columns to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS utm_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_medium text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_campaign text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_term text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fbclid text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_campaign_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_adset_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_ad_id text NOT NULL DEFAULT '';
