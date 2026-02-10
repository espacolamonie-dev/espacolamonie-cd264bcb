import { supabase } from "@/integrations/supabase/client";

// Helper to get current user id
const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  return user.id;
};

// CLIENTS
export const getClients = async () => {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapClient);
};

export const addClient = async (c: { name: string; cpf: string; phone: string; email: string; address: string; notes: string }) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from("clients").insert({ ...c, user_id: userId }).select().single();
  if (error) throw error;
  return mapClient(data);
};

export const updateClient = async (id: string, data: Record<string, any>) => {
  const { error } = await supabase.from("clients").update(data).eq("id", id);
  if (error) throw error;
};

export const deleteClient = async (id: string) => {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
};

// CONTRACTS
export const getContracts = async () => {
  const { data, error } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapContract);
};

export const addContract = async (c: {
  clientId: string; eventType: string; eventDate: string; eventTime: string;
  guestCount: number; totalValue: number; depositPercent: number;
  status: string; paymentStatus: string;
}) => {
  const userId = await getUserId();
  const depositValue = (c.totalValue * c.depositPercent) / 100;
  const { data, error } = await supabase.from("contracts").insert({
    user_id: userId,
    client_id: c.clientId,
    event_type: c.eventType,
    event_date: c.eventDate,
    event_time: c.eventTime,
    guest_count: c.guestCount,
    total_value: c.totalValue,
    deposit_percent: c.depositPercent,
    deposit_value: depositValue,
    remaining_value: c.totalValue,
    status: c.status,
    payment_status: c.paymentStatus,
  }).select().single();
  if (error) throw error;
  return mapContract(data);
};

export const updateContract = async (id: string, updates: Record<string, any>) => {
  // Map camelCase to snake_case
  const mapped: Record<string, any> = {};
  const keyMap: Record<string, string> = {
    clientId: "client_id", eventType: "event_type", eventDate: "event_date",
    eventTime: "event_time", guestCount: "guest_count", totalValue: "total_value",
    depositPercent: "deposit_percent", depositValue: "deposit_value",
    remainingValue: "remaining_value", paymentStatus: "payment_status",
    cancelledAt: "cancelled_at", cancelledBy: "cancelled_by",
  };
  for (const [k, v] of Object.entries(updates)) {
    mapped[keyMap[k] || k] = v;
  }
  const { error } = await supabase.from("contracts").update(mapped).eq("id", id);
  if (error) throw error;
};

// PAYMENTS
export const getPayments = async () => {
  const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPayment);
};

export const addPayment = async (p: { contractId: string; amount: number; date: string; description: string }) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from("payments").insert({
    user_id: userId,
    contract_id: p.contractId,
    amount: p.amount,
    date: p.date,
    description: p.description,
  }).select().single();
  if (error) throw error;

  // Update contract remaining value and payment status
  const allPayments = await supabase.from("payments").select("amount").eq("contract_id", p.contractId);
  const contractRes = await supabase.from("contracts").select("total_value").eq("id", p.contractId).single();
  
  if (allPayments.data && contractRes.data) {
    const totalPaid = allPayments.data.reduce((s, pay) => s + Number(pay.amount), 0);
    const remaining = Math.max(0, Number(contractRes.data.total_value) - totalPaid);
    let paymentStatus = "pending";
    if (remaining <= 0) paymentStatus = "paid_full";
    else if (totalPaid > 0) paymentStatus = "deposit_paid";
    await supabase.from("contracts").update({ remaining_value: remaining, payment_status: paymentStatus }).eq("id", p.contractId);
  }

  return mapPayment(data);
};

// DOCUMENTS
export const getDocuments = async () => {
  const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDocument);
};

export const addDocument = async (d: { contractId: string; name: string; type: string; fileName: string }) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from("documents").insert({
    user_id: userId,
    contract_id: d.contractId,
    name: d.name,
    type: d.type,
    file_name: d.fileName,
  }).select().single();
  if (error) throw error;
  return mapDocument(data);
};

// EXPENSES
export const getExpenses = async () => {
  const { data, error } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapExpense);
};

export const addExpense = async (e: { description: string; category: string; amount: number; date: string }) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from("expenses").insert({ ...e, user_id: userId }).select().single();
  if (error) throw error;
  return mapExpense(data);
};

export const deleteExpense = async (id: string) => {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
};

// MANUAL ENTRIES
export const getManualEntries = async () => {
  const { data, error } = await supabase.from("manual_entries").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapManualEntry);
};

export const addManualEntry = async (e: {
  description: string; category: string; amount: number; date: string;
  paymentMethod: string; notes: string;
}) => {
  const userId = await getUserId();
  const { data, error } = await supabase.from("manual_entries").insert({
    user_id: userId,
    description: e.description,
    category: e.category,
    amount: e.amount,
    date: e.date,
    payment_method: e.paymentMethod,
    notes: e.notes,
  }).select().single();
  if (error) throw error;
  return mapManualEntry(data);
};

export const deleteManualEntry = async (id: string) => {
  const { error } = await supabase.from("manual_entries").delete().eq("id", id);
  if (error) throw error;
};

// FINANCIAL HELPERS
export const getTotalEntries = async (): Promise<number> => {
  const payments = await getPayments();
  const manual = await getManualEntries();
  return payments.reduce((s, p) => s + p.amount, 0) + manual.reduce((s, e) => s + e.amount, 0);
};

export const getTotalExpenses = async (): Promise<number> => {
  const expenses = await getExpenses();
  return expenses.reduce((s, e) => s + e.amount, 0);
};

export const getBalance = async (): Promise<number> => {
  const totalIn = await getTotalEntries();
  const totalOut = await getTotalExpenses();
  return totalIn - totalOut;
};

// Mappers: snake_case DB rows → camelCase app types
function mapClient(row: any) {
  return {
    id: row.id,
    name: row.name,
    cpf: row.cpf || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    notes: row.notes || "",
    createdAt: row.created_at,
  };
}

function mapContract(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    eventType: row.event_type,
    eventDate: row.event_date,
    eventTime: row.event_time || "",
    guestCount: Number(row.guest_count),
    totalValue: Number(row.total_value),
    depositPercent: Number(row.deposit_percent),
    depositValue: Number(row.deposit_value),
    remainingValue: Number(row.remaining_value),
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
  };
}

function mapPayment(row: any) {
  return {
    id: row.id,
    contractId: row.contract_id,
    amount: Number(row.amount),
    date: row.date,
    description: row.description || "",
    createdAt: row.created_at,
  };
}

function mapDocument(row: any) {
  return {
    id: row.id,
    contractId: row.contract_id,
    name: row.name,
    type: row.type,
    fileName: row.file_name || "",
    createdAt: row.created_at,
  };
}

function mapExpense(row: any) {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    date: row.date,
    createdAt: row.created_at,
  };
}

function mapManualEntry(row: any) {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    date: row.date,
    paymentMethod: row.payment_method,
    notes: row.notes || "",
    createdAt: row.created_at,
  };
}
