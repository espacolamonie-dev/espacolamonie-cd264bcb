
-- Push notification VAPID config (only accessible by service_role)
CREATE TABLE push_config (
  id text PRIMARY KEY DEFAULT 'default',
  vapid_public_key text NOT NULL,
  vapid_private_key_jwk text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE push_config ENABLE ROW LEVEL SECURITY;

-- Push subscriptions per user device
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subs" ON push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
