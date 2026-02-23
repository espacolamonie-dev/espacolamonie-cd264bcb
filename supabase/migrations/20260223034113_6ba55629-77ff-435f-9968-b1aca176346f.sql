
-- Create pipeline_stages table for dynamic/editable pipeline
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stage_key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  default_template_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, stage_key)
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pipeline stages"
  ON public.pipeline_stages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipeline stages"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipeline stages"
  ON public.pipeline_stages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pipeline stages"
  ON public.pipeline_stages FOR DELETE
  USING (auth.uid() = user_id);
