import { supabase } from "@/integrations/supabase/client";
import { getUtmForDb } from "@/lib/utmTracker";
import { todayLocalStr } from "@/lib/dateUtils";

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

export const addClient = async (c: { name: string; cpf: string; phone: string; email?: string; address: string; notes: string; address_street?: string; address_number?: string; address_complement?: string; address_neighborhood?: string; address_city?: string; address_state?: string; address_zip?: string }) => {
  const userId = await getUserId();
  const utm = getUtmForDb();
  const { data, error } = await supabase.from("clients").insert({ ...c, user_id: userId, ...utm } as any).select().single();
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
  clientId: string; eventType: string; eventDate: string; eventDateEnd?: string;
  rentalType?: string; eventTime: string;
  guestCount: number; totalValue: number; depositPercent: number;
  status: string; paymentStatus: string;
  visitId?: string; source?: string;
}) => {
  const userId = await getUserId();
  const depositValue = (c.totalValue * c.depositPercent) / 100;
  const utm = getUtmForDb();

  // Auto-copy origin: source param > client.utm_source > visit.lead_source > "Orgânico"
  let source = c.source || "";
  if (!source && c.clientId) {
    try {
      const { data: clientData } = await supabase.from("clients").select("utm_source").eq("id", c.clientId).single();
      if (clientData?.utm_source) source = clientData.utm_source;
    } catch {}
  }
  if (!source && c.visitId) {
    try {
      const { data: visitData } = await supabase.from("visits" as any).select("lead_source").eq("id", c.visitId).single() as any;
      if (visitData?.lead_source) source = visitData.lead_source;
    } catch {}
  }
  if (!source) source = "Orgânico";

  // Set reserved_until to 24h from now
  const reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.from("contracts").insert({
    user_id: userId,
    client_id: c.clientId,
    event_type: c.eventType,
    event_date: c.eventDate,
    event_date_end: c.eventDateEnd || null,
    rental_type: c.rentalType || "Locação (1 dia)",
    event_time: c.eventTime,
    guest_count: c.guestCount,
    total_value: c.totalValue,
    deposit_percent: c.depositPercent,
    deposit_value: depositValue,
    remaining_value: c.totalValue,
    status: c.status,
    payment_status: c.paymentStatus,
    visit_id: c.visitId || null,
    source: source,
    reserved_until: reservedUntil,
    ...utm,
  } as any).select().single();
  if (error) throw error;

  // Track Meta: InitiateCheckout — only for paid traffic
  if (source === "Tráfego Pago") {
    (async () => {
      try {
        const { data: clientData } = await supabase.from("clients").select("name, phone, email").eq("id", c.clientId).single();
        const { trackMetaEvent } = await import("@/lib/metaPixel");
        await trackMetaEvent("InitiateCheckout", {
          phone: clientData?.phone,
          email: clientData?.email,
          name: clientData?.name,
        }, {
          content_name: source || "Direto",
          content_category: c.eventType,
        }, {
          totalValue: c.totalValue,
          depositValue: depositValue,
        });
      } catch {}
    })();
  }

  return mapContract(data);
};

export const deleteContract = async (id: string) => {
  // With CASCADE DELETE configured, this removes all related records automatically
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw error;
};

export const getContractsByClient = async (clientId: string) => {
  const { data, error } = await supabase.from("contracts").select("id, status").eq("client_id", clientId);
  if (error) throw error;
  return data || [];
};

export const updateContract = async (id: string, updates: Record<string, any>) => {
  // Map camelCase to snake_case
  const mapped: Record<string, any> = {};
  const keyMap: Record<string, string> = {
    clientId: "client_id", eventType: "event_type", eventDate: "event_date",
    eventDateEnd: "event_date_end", rentalType: "rental_type",
    eventTime: "event_time", guestCount: "guest_count", totalValue: "total_value",
    depositPercent: "deposit_percent", depositValue: "deposit_value",
    remainingValue: "remaining_value", paymentStatus: "payment_status",
    cancelledAt: "cancelled_at", cancelledBy: "cancelled_by",
    visitId: "visit_id", source: "source",
    reservedUntil: "reserved_until",
  };
  for (const [k, v] of Object.entries(updates)) {
    mapped[keyMap[k] || k] = v;
  }

  // Handle cancellation — remove associated payments
  if (updates.status === "cancelled") {
    await supabase.from("payments").delete().eq("contract_id", id);
    mapped.payment_status = "pending";
    mapped.remaining_value = 0;
  }

  // Payment status changed — preserve existing payments, only add the difference
  if (updates.paymentStatus !== undefined && updates.status !== "cancelled") {
    const userId = await getUserId();

    const contractRes = await supabase.from("contracts").select("*").eq("id", id).single();
    if (contractRes.data) {
      const contract = mapContract(contractRes.data);

      // Get current total paid (preserve historical payments)
      const { data: existingPayments } = await supabase.from("payments").select("amount").eq("contract_id", id);
      const currentPaid = (existingPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

      if (updates.paymentStatus === "deposit_paid") {
        const depositValue = (contract.totalValue * contract.depositPercent) / 100;
        const diff = depositValue - currentPaid;
        if (diff > 0.009) {
          await supabase.from("payments").insert({
            user_id: userId, contract_id: id, amount: diff,
            date: todayLocalStr(),
            description: currentPaid > 0 ? "Complemento do sinal" : "Sinal pago automaticamente",
          });
        }
        // If currentPaid already >= depositValue, do not delete or alter history
        const newTotal = Math.max(currentPaid, depositValue);
        mapped.remaining_value = Math.max(0, contract.totalValue - newTotal);

        // Track Meta: Purchase — only for paid traffic
        if (contract.source === "Tráfego Pago") {
          (async () => {
            try {
              const { data: clientData } = await supabase.from("clients").select("name, phone, email").eq("id", contract.clientId).single();
              const { trackMetaEvent } = await import("@/lib/metaPixel");
              await trackMetaEvent("Purchase", {
                phone: clientData?.phone,
                email: clientData?.email,
                name: clientData?.name,
              }, {
                content_name: contract.eventType,
              }, {
                totalValue: contract.totalValue,
                depositValue: depositValue,
              });
            } catch {}
          })();
        }
      } else if (updates.paymentStatus === "paid_full") {
        const diff = contract.totalValue - currentPaid;
        if (diff > 0.009) {
          await supabase.from("payments").insert({
            user_id: userId, contract_id: id, amount: diff,
            date: todayLocalStr(),
            description: currentPaid > 0 ? "Pagamento do valor restante" : "Pagamento total registrado automaticamente",
          });
        }
        mapped.remaining_value = 0;
      } else if (updates.paymentStatus === "pending") {
        // Reverting to pending clears history
        await supabase.from("payments").delete().eq("contract_id", id);
        mapped.remaining_value = contract.totalValue;
      }
    }
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

export const addDocumentFromBlob = async (d: { contractId: string; name: string; type: string; file: File }) => {
  return addDocument(d);
};

export const addDocument = async (d: { contractId: string; name: string; type: string; file: File }) => {
  const userId = await getUserId();
  const fileExt = d.file.name.split(".").pop();
  const filePath = `${userId}/${d.contractId}/${Date.now()}.${fileExt}`;

  // Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, d.file);
  if (uploadError) throw uploadError;

  // Save document record
  const { data, error } = await supabase.from("documents").insert({
    user_id: userId,
    contract_id: d.contractId,
    name: d.name,
    type: d.type,
    file_name: filePath,
  }).select().single();
  if (error) throw error;
  return mapDocument(data);
};

export const getDocumentSignedUrl = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
};

export const deleteDocument = async (id: string, filePath: string) => {
  await supabase.storage.from("documents").remove([filePath]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
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

// FINANCIAL HELPERS — exclude payments from cancelled contracts
export const getActivePayments = async () => {
  const [payments, contracts] = await Promise.all([getPayments(), getContracts()]);
  const cancelledIds = new Set(contracts.filter(c => c.status === "cancelled").map(c => c.id));
  return payments.filter(p => !cancelledIds.has(p.contractId));
};

export const getTotalEntries = async (): Promise<number> => {
  const activePayments = await getActivePayments();
  const manual = await getManualEntries();
  return activePayments.reduce((s, p) => s + p.amount, 0) + manual.reduce((s, e) => s + e.amount, 0);
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
    addressStreet: row.address_street || "",
    addressNumber: row.address_number || "",
    addressComplement: row.address_complement || "",
    addressNeighborhood: row.address_neighborhood || "",
    addressCity: row.address_city || "",
    addressState: row.address_state || "",
    addressZip: row.address_zip || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    utmSource: row.utm_source || "",
  };
}

function mapContract(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    eventType: row.event_type,
    eventDate: row.event_date,
    eventDateEnd: row.event_date_end || undefined,
    rentalType: row.rental_type || "Locação (1 dia)",
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
    visitId: row.visit_id || null,
    source: row.source || "",
    utmSource: row.utm_source || "",
    utmCampaign: row.utm_campaign || "",
    utmMedium: row.utm_medium || "",
    utmContent: row.utm_content || "",
    utmTerm: row.utm_term || "",
    fbclid: row.fbclid || "",
    metaCampaignId: row.meta_campaign_id || "",
    metaAdsetId: row.meta_adset_id || "",
    metaAdId: row.meta_ad_id || "",
    paymentChoice: row.payment_choice || "",
    paymentMethodSelected: row.payment_method_selected || "",
    paymentDueDate: row.payment_due_date || "",
    paymentFollowupRequired: row.payment_followup_required || false,
    reservedUntil: row.reserved_until || undefined,
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
