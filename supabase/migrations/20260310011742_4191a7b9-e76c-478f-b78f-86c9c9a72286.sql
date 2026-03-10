
-- Tabela de catálogo de itens
CREATE TABLE public.budget_items_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  supplier text NOT NULL DEFAULT '',
  default_unit_price numeric NOT NULL DEFAULT 0,
  default_percentage numeric NOT NULL DEFAULT 0,
  unit_label text NOT NULL DEFAULT 'unidade',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_items_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own catalog items" ON public.budget_items_catalog
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela principal de orçamentos
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT '',
  event_date date,
  guest_count integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  global_percentage numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  additional_total numeric NOT NULL DEFAULT 0,
  final_total numeric NOT NULL DEFAULT 0,
  public_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  pdf_url text,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budgets" ON public.budgets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read budgets by token" ON public.budgets
  FOR SELECT TO anon, authenticated
  USING (true);

-- Tabela de itens do orçamento
CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.budget_items_catalog(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  supplier text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1,
  unit_label text NOT NULL DEFAULT 'unidade',
  line_total numeric NOT NULL DEFAULT 0,
  percentage_applied numeric NOT NULL DEFAULT 0,
  additional_value numeric NOT NULL DEFAULT 0,
  final_value numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budget items" ON public.budget_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read budget items" ON public.budget_items
  FOR SELECT TO anon, authenticated
  USING (true);

-- Tabela de logs
CREATE TABLE public.budget_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_status text,
  new_status text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budget logs" ON public.budget_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
