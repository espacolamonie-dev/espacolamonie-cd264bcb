import { supabase } from "@/integrations/supabase/client";

const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  return user.id;
};

// ── Types ──
export type BudgetStatus = "draft" | "sent" | "approved" | "rejected" | "converted";

export interface Budget {
  id: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  eventType: string;
  eventDate: string | null;
  guestCount: number;
  notes: string;
  status: BudgetStatus;
  globalPercentage: number;
  subtotal: number;
  additionalTotal: number;
  finalTotal: number;
  publicToken: string;
  pdfUrl: string | null;
  contractId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetItem {
  id: string;
  budgetId: string;
  catalogItemId: string | null;
  name: string;
  category: string;
  supplier: string;
  unitPrice: number;
  quantity: number;
  unitLabel: string;
  lineTotal: number;
  percentageApplied: number;
  additionalValue: number;
  finalValue: number;
  sortOrder: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  supplier: string;
  defaultUnitPrice: number;
  defaultPercentage: number;
  unitLabel: string;
  isActive: boolean;
}

export interface BudgetLog {
  id: string;
  budgetId: string;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  notes: string;
  createdAt: string;
}

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
  converted: "Convertido",
};

export const BUDGET_STATUS_COLORS: Record<BudgetStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-primary/15 text-primary border-primary/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-danger/15 text-danger border-danger/30",
  converted: "bg-warning/15 text-warning border-warning/30",
};

// ── Mappers ──
function mapBudget(row: any): Budget {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone || "",
    eventType: row.event_type || "",
    eventDate: row.event_date,
    guestCount: Number(row.guest_count),
    notes: row.notes || "",
    status: row.status as BudgetStatus,
    globalPercentage: Number(row.global_percentage),
    subtotal: Number(row.subtotal),
    additionalTotal: Number(row.additional_total),
    finalTotal: Number(row.final_total),
    publicToken: row.public_token,
    pdfUrl: row.pdf_url,
    contractId: row.contract_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBudgetItem(row: any): BudgetItem {
  return {
    id: row.id,
    budgetId: row.budget_id,
    catalogItemId: row.catalog_item_id,
    name: row.name,
    category: row.category || "",
    supplier: row.supplier || "",
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    unitLabel: row.unit_label || "unidade",
    lineTotal: Number(row.line_total),
    percentageApplied: Number(row.percentage_applied),
    additionalValue: Number(row.additional_value),
    finalValue: Number(row.final_value),
    sortOrder: Number(row.sort_order),
  };
}

function mapCatalogItem(row: any): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category || "",
    supplier: row.supplier || "",
    defaultUnitPrice: Number(row.default_unit_price),
    defaultPercentage: Number(row.default_percentage),
    unitLabel: row.unit_label || "unidade",
    isActive: row.is_active,
  };
}

function mapLog(row: any): BudgetLog {
  return {
    id: row.id,
    budgetId: row.budget_id,
    action: row.action,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    notes: row.notes || "",
    createdAt: row.created_at,
  };
}

// ── Slug helper ──
function generateSlug(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(baseName: string): Promise<string> {
  const base = generateSlug(baseName);
  // Check if slug exists
  const { data } = await supabase.from("budgets").select("id").eq("public_token", base).maybeSingle();
  if (!data) return base;
  // Add short random suffix
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

// ── BUDGETS CRUD ──
export const getBudgets = async (): Promise<Budget[]> => {
  const { data, error } = await supabase.from("budgets").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapBudget);
};

export const getBudgetById = async (id: string): Promise<Budget> => {
  const { data, error } = await supabase.from("budgets").select("*").eq("id", id).single();
  if (error) throw error;
  return mapBudget(data);
};

export const getBudgetByToken = async (token: string): Promise<Budget | null> => {
  const { data, error } = await supabase.from("budgets").select("*").eq("public_token", token).single();
  if (error) return null;
  return mapBudget(data);
};

export const addBudget = async (b: {
  clientId?: string | null;
  clientName: string;
  clientPhone?: string;
  eventType?: string;
  eventDate?: string | null;
  guestCount?: number;
  notes?: string;
  status?: BudgetStatus;
  globalPercentage?: number;
}): Promise<Budget> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from("budgets").insert({
    user_id: userId,
    client_id: b.clientId || null,
    client_name: b.clientName,
    client_phone: b.clientPhone || "",
    event_type: b.eventType || "",
    event_date: b.eventDate || null,
    guest_count: b.guestCount || 0,
    notes: b.notes || "",
    status: b.status || "draft",
    global_percentage: b.globalPercentage || 0,
  }).select().single();
  if (error) throw error;

  // Log creation
  await supabase.from("budget_logs").insert({
    user_id: userId,
    budget_id: data.id,
    action: "created",
    new_status: "draft",
  });

  return mapBudget(data);
};

export const updateBudget = async (id: string, updates: Record<string, any>): Promise<void> => {
  const keyMap: Record<string, string> = {
    clientId: "client_id", clientName: "client_name", clientPhone: "client_phone",
    eventType: "event_type", eventDate: "event_date", guestCount: "guest_count",
    globalPercentage: "global_percentage", additionalTotal: "additional_total",
    finalTotal: "final_total", publicToken: "public_token", pdfUrl: "pdf_url",
    contractId: "contract_id",
  };
  const mapped: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(updates)) {
    mapped[keyMap[k] || k] = v;
  }
  const { error } = await supabase.from("budgets").update(mapped).eq("id", id);
  if (error) throw error;
};

export const updateBudgetStatus = async (id: string, newStatus: BudgetStatus, notes?: string): Promise<void> => {
  const userId = await getUserId();
  const budget = await getBudgetById(id);
  await updateBudget(id, { status: newStatus });
  await supabase.from("budget_logs").insert({
    user_id: userId,
    budget_id: id,
    action: "status_changed",
    old_status: budget.status,
    new_status: newStatus,
    notes: notes || "",
  });
};

export const deleteBudget = async (id: string): Promise<void> => {
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
};

export const duplicateBudget = async (id: string): Promise<Budget> => {
  const original = await getBudgetById(id);
  const items = await getBudgetItems(id);
  const newBudget = await addBudget({
    clientId: original.clientId,
    clientName: original.clientName,
    clientPhone: original.clientPhone,
    eventType: original.eventType,
    eventDate: original.eventDate,
    guestCount: original.guestCount,
    notes: original.notes,
    status: "draft",
    globalPercentage: original.globalPercentage,
  });

  // Copy items
  const userId = await getUserId();
  for (const item of items) {
    await supabase.from("budget_items").insert({
      user_id: userId,
      budget_id: newBudget.id,
      catalog_item_id: item.catalogItemId,
      name: item.name,
      category: item.category,
      supplier: item.supplier,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      unit_label: item.unitLabel,
      line_total: item.lineTotal,
      percentage_applied: item.percentageApplied,
      additional_value: item.additionalValue,
      final_value: item.finalValue,
      sort_order: item.sortOrder,
    });
  }

  // Recalculate totals
  await recalcBudgetTotals(newBudget.id);
  return getBudgetById(newBudget.id);
};

// ── BUDGET ITEMS CRUD ──
export const getBudgetItems = async (budgetId: string): Promise<BudgetItem[]> => {
  const { data, error } = await supabase.from("budget_items").select("*").eq("budget_id", budgetId).order("sort_order");
  if (error) throw error;
  return (data || []).map(mapBudgetItem);
};

export const addBudgetItem = async (budgetId: string, item: {
  catalogItemId?: string | null;
  name: string;
  category?: string;
  supplier?: string;
  unitPrice: number;
  quantity: number;
  unitLabel?: string;
  percentageApplied: number;
  sortOrder?: number;
}): Promise<BudgetItem> => {
  const userId = await getUserId();
  const lineTotal = item.unitPrice * item.quantity;
  const additionalValue = lineTotal * (item.percentageApplied / 100);
  const finalValue = lineTotal + additionalValue;

  const { data, error } = await supabase.from("budget_items").insert({
    user_id: userId,
    budget_id: budgetId,
    catalog_item_id: item.catalogItemId || null,
    name: item.name,
    category: item.category || "",
    supplier: item.supplier || "",
    unit_price: item.unitPrice,
    quantity: item.quantity,
    unit_label: item.unitLabel || "unidade",
    line_total: lineTotal,
    percentage_applied: item.percentageApplied,
    additional_value: additionalValue,
    final_value: finalValue,
    sort_order: item.sortOrder || 0,
  }).select().single();
  if (error) throw error;

  await recalcBudgetTotals(budgetId);
  return mapBudgetItem(data);
};

export const updateBudgetItem = async (itemId: string, budgetId: string, updates: {
  name?: string;
  category?: string;
  supplier?: string;
  unitPrice?: number;
  quantity?: number;
  unitLabel?: string;
  percentageApplied?: number;
  sortOrder?: number;
}): Promise<void> => {
  // Fetch current item to fill in defaults
  const { data: current } = await supabase.from("budget_items").select("*").eq("id", itemId).single();
  if (!current) return;

  const unitPrice = updates.unitPrice ?? Number(current.unit_price);
  const quantity = updates.quantity ?? Number(current.quantity);
  const pct = updates.percentageApplied ?? Number(current.percentage_applied);
  const lineTotal = unitPrice * quantity;
  const additionalValue = lineTotal * (pct / 100);
  const finalValue = lineTotal + additionalValue;

  const mapped: Record<string, any> = {
    updated_at: new Date().toISOString(),
    unit_price: unitPrice,
    quantity,
    line_total: lineTotal,
    percentage_applied: pct,
    additional_value: additionalValue,
    final_value: finalValue,
  };
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.category !== undefined) mapped.category = updates.category;
  if (updates.supplier !== undefined) mapped.supplier = updates.supplier;
  if (updates.unitLabel !== undefined) mapped.unit_label = updates.unitLabel;
  if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder;

  await supabase.from("budget_items").update(mapped).eq("id", itemId);
  await recalcBudgetTotals(budgetId);
};

export const deleteBudgetItem = async (itemId: string, budgetId: string): Promise<void> => {
  await supabase.from("budget_items").delete().eq("id", itemId);
  await recalcBudgetTotals(budgetId);
};

// ── Recalculate totals ──
export const recalcBudgetTotals = async (budgetId: string): Promise<void> => {
  const items = await getBudgetItems(budgetId);
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const additionalTotal = items.reduce((s, i) => s + i.additionalValue, 0);
  const finalTotal = subtotal + additionalTotal;
  await supabase.from("budgets").update({ subtotal, additional_total: additionalTotal, final_total: finalTotal, updated_at: new Date().toISOString() }).eq("id", budgetId);
};

// ── CATALOG CRUD ──
export const getCatalogItems = async (): Promise<CatalogItem[]> => {
  const { data, error } = await supabase.from("budget_items_catalog").select("*").eq("is_active", true).order("name");
  if (error) throw error;
  return (data || []).map(mapCatalogItem);
};

export const addCatalogItem = async (item: {
  name: string; category?: string; supplier?: string;
  defaultUnitPrice?: number; defaultPercentage?: number; unitLabel?: string;
}): Promise<CatalogItem> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from("budget_items_catalog").insert({
    user_id: userId,
    name: item.name,
    category: item.category || "",
    supplier: item.supplier || "",
    default_unit_price: item.defaultUnitPrice || 0,
    default_percentage: item.defaultPercentage || 0,
    unit_label: item.unitLabel || "unidade",
  }).select().single();
  if (error) throw error;
  return mapCatalogItem(data);
};

export const updateCatalogItem = async (id: string, updates: Record<string, any>): Promise<void> => {
  const keyMap: Record<string, string> = {
    defaultUnitPrice: "default_unit_price",
    defaultPercentage: "default_percentage",
    unitLabel: "unit_label",
    isActive: "is_active",
  };
  const mapped: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(updates)) {
    mapped[keyMap[k] || k] = v;
  }
  await supabase.from("budget_items_catalog").update(mapped).eq("id", id);
};

export const deleteCatalogItem = async (id: string): Promise<void> => {
  await supabase.from("budget_items_catalog").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
};

// ── LOGS ──
export const getBudgetLogs = async (budgetId: string): Promise<BudgetLog[]> => {
  const { data, error } = await supabase.from("budget_logs").select("*").eq("budget_id", budgetId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapLog);
};
