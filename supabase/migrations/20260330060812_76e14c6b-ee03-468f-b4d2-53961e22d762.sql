-- Fix 1: Drop dangerous public RLS policies on contract_signatures
-- These allow any anonymous user to read all pending signatures and update them
DROP POLICY IF EXISTS "Public can read pending signatures by token" ON public.contract_signatures;
DROP POLICY IF EXISTS "Sign via token restricted" ON public.contract_signatures;

-- Fix 2: Add TO authenticated to tables that are missing it
-- payments
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON public.payments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON public.payments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- manual_entries
DROP POLICY IF EXISTS "Users can view own manual_entries" ON public.manual_entries;
DROP POLICY IF EXISTS "Users can insert own manual_entries" ON public.manual_entries;
DROP POLICY IF EXISTS "Users can update own manual_entries" ON public.manual_entries;
DROP POLICY IF EXISTS "Users can delete own manual_entries" ON public.manual_entries;
CREATE POLICY "Users can view own manual_entries" ON public.manual_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manual_entries" ON public.manual_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own manual_entries" ON public.manual_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own manual_entries" ON public.manual_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- google_settings
DROP POLICY IF EXISTS "Users can manage own google settings" ON public.google_settings;
CREATE POLICY "Users can manage own google settings" ON public.google_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- google_sync_logs
DROP POLICY IF EXISTS "Service can insert sync logs" ON public.google_sync_logs;
DROP POLICY IF EXISTS "Users can view own sync logs" ON public.google_sync_logs;
CREATE POLICY "Users can view own sync logs" ON public.google_sync_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service can insert sync logs" ON public.google_sync_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- leads
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON public.leads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- lead_status_history
DROP POLICY IF EXISTS "Users can view own lead history" ON public.lead_status_history;
DROP POLICY IF EXISTS "Users can insert own lead history" ON public.lead_status_history;
CREATE POLICY "Users can view own lead history" ON public.lead_status_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lead history" ON public.lead_status_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- whatsapp_templates
DROP POLICY IF EXISTS "Users can manage own templates" ON public.whatsapp_templates;
CREATE POLICY "Users can manage own templates" ON public.whatsapp_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pix_settings
DROP POLICY IF EXISTS "Users can manage own pix settings" ON public.pix_settings;
CREATE POLICY "Users can manage own pix settings" ON public.pix_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pipeline_stages
DROP POLICY IF EXISTS "Users can view own pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can insert own pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update own pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete own pipeline stages" ON public.pipeline_stages;
CREATE POLICY "Users can view own pipeline stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pipeline stages" ON public.pipeline_stages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pipeline stages" ON public.pipeline_stages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pipeline stages" ON public.pipeline_stages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- whatsapp_connection
DROP POLICY IF EXISTS "Users can manage own whatsapp connection" ON public.whatsapp_connection;
CREATE POLICY "Users can manage own whatsapp connection" ON public.whatsapp_connection FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- whatsapp_messages
DROP POLICY IF EXISTS "Users can manage own messages" ON public.whatsapp_messages;
CREATE POLICY "Users can manage own messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- stage_automation_rules
DROP POLICY IF EXISTS "Users can manage own automation rules" ON public.stage_automation_rules;
CREATE POLICY "Users can manage own automation rules" ON public.stage_automation_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- whatsapp_logs
DROP POLICY IF EXISTS "Users can view own whatsapp logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Users can insert own whatsapp logs" ON public.whatsapp_logs;
CREATE POLICY "Users can view own whatsapp logs" ON public.whatsapp_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whatsapp logs" ON public.whatsapp_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- company_settings
DROP POLICY IF EXISTS "Users can manage own company settings" ON public.company_settings;
CREATE POLICY "Users can manage own company settings" ON public.company_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- daily_whatsapp_contacts
DROP POLICY IF EXISTS "Users can manage own daily contacts" ON public.daily_whatsapp_contacts;
CREATE POLICY "Users can manage own daily contacts" ON public.daily_whatsapp_contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
