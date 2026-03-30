import { supabase } from "@/integrations/supabase/client";
import { getUtmForDb } from "@/lib/utmTracker";

const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  return user.id;
};

export type LeadSource = "Orgânico" | "Tráfego Pago" | "Instagram" | "Facebook" | "Google" | "Indicação" | "Outro";

export const LEAD_SOURCE_OPTIONS: LeadSource[] = [
  "Instagram", "Facebook", "Google", "Tráfego Pago", "Indicação", "Orgânico", "Outro",
];

export interface Visit {
  id: string;
  clientName: string;
  clientPhone: string;
  interestEventDate: string | null;
  visitDate: string;
  visitTime: string;
  notes: string;
  status: string;
  leadSource: LeadSource | string;
  guestCount: number;
  eventTypeDesired: string;
  eventValue: number;
  depositPercent: number;
  clientId: string | null;
  googleEventId: string | null;
  createdAt: string;
  updatedAt: string;
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
  utmContent: string;
  utmTerm: string;
  fbclid: string;
  metaCampaignId: string;
  metaAdsetId: string;
  metaAdId: string;
}

function mapVisit(row: any): Visit {
  return {
    id: row.id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    interestEventDate: row.interest_event_date,
    visitDate: row.visit_date,
    visitTime: row.visit_time,
    notes: row.notes || "",
    status: row.status,
    leadSource: row.lead_source || "Orgânico",
    guestCount: row.guest_count || 0,
    eventTypeDesired: row.event_type_desired || "",
    eventValue: Number(row.event_value) || 0,
    depositPercent: Number(row.deposit_percent) || 0,
    clientId: row.client_id || null,
    googleEventId: row.google_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    utmSource: row.utm_source || "",
    utmCampaign: row.utm_campaign || "",
    utmMedium: row.utm_medium || "",
    utmContent: row.utm_content || "",
    utmTerm: row.utm_term || "",
    fbclid: row.fbclid || "",
    metaCampaignId: row.meta_campaign_id || "",
    metaAdsetId: row.meta_adset_id || "",
    metaAdId: row.meta_ad_id || "",
  };
}

export const getVisits = async (): Promise<Visit[]> => {
  const { data, error } = await supabase
    .from("visits" as any)
    .select("*")
    .order("visit_date", { ascending: true })
    .order("visit_time", { ascending: true });
  if (error) throw error;
  return ((data as any[]) || []).map(mapVisit);
};

export const addVisit = async (v: {
  clientName: string;
  clientPhone: string;
  interestEventDate: string | null;
  visitDate: string;
  visitTime: string;
  notes: string;
  leadSource?: LeadSource;
  eventTypeDesired?: string;
  eventValue?: number;
  depositPercent?: number;
  guestCount?: number;
}): Promise<Visit> => {
  const userId = await getUserId();

  // Auto-create or update client
  const normalizedPhone = v.clientPhone.replace(/\D/g, "");
  let clientId: string | null = null;
  
  // Check if client with same phone exists
  const { data: existingClients } = await supabase
    .from("clients")
    .select("id, name, phone, notes, utm_source")
    .eq("user_id", userId);
  
  const matchingClient = (existingClients || []).find(
    (c) => c.phone.replace(/\D/g, "") === normalizedPhone
  );
  
   if (matchingClient) {
    clientId = matchingClient.id;
    // Update client if visit has more data — copy origin if client doesn't have one
    const updates: Record<string, any> = {};
    if (!matchingClient.notes && v.notes) updates.notes = v.notes;
    if (!(matchingClient as any).utm_source && v.leadSource) updates.utm_source = v.leadSource;
    if (Object.keys(updates).length > 0) {
      await supabase.from("clients").update(updates).eq("id", clientId);
    }
  } else {
    // Create new client — copy origin from visit
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        name: v.clientName.trim(),
        phone: v.clientPhone.trim(),
        notes: v.notes || "",
        utm_source: v.leadSource || "Orgânico",
      })
      .select()
      .single();
    if (!clientError && newClient) {
      clientId = newClient.id;
    }
  }

  const utm = getUtmForDb();
  const { data, error } = await (supabase.from("visits" as any) as any)
    .insert({
      user_id: userId,
      client_name: v.clientName,
      client_phone: v.clientPhone,
      interest_event_date: v.interestEventDate || null,
      visit_date: v.visitDate,
      visit_time: v.visitTime,
      notes: v.notes,
      lead_source: v.leadSource || "Orgânico",
      event_type_desired: v.eventTypeDesired || "",
      event_value: v.eventValue || 0,
      deposit_percent: v.depositPercent || 0,
      guest_count: v.guestCount || 0,
      client_id: clientId,
      ...utm,
    })
    .select()
    .single();
  if (error) throw error;

  // Track Meta: Schedule (visit created)
  import("@/lib/metaPixel").then(({ trackMetaEvent }) => {
    trackMetaEvent("Schedule", { phone: v.clientPhone, name: v.clientName }, {
      content_name: "Visita agendada",
      content_category: v.eventTypeDesired || "",
    }).catch(() => {});
  });

  return mapVisit(data);
};

export const updateVisit = async (id: string, updates: Record<string, any>): Promise<void> => {
  const mapped: Record<string, any> = {};
  const keyMap: Record<string, string> = {
    clientName: "client_name",
    clientPhone: "client_phone",
    interestEventDate: "interest_event_date",
    visitDate: "visit_date",
    visitTime: "visit_time",
    googleEventId: "google_event_id",
    leadSource: "lead_source",
    eventTypeDesired: "event_type_desired",
    eventValue: "event_value",
    depositPercent: "deposit_percent",
    guestCount: "guest_count",
    clientId: "client_id",
  };
  for (const [k, v] of Object.entries(updates)) {
    mapped[keyMap[k] || k] = v;
  }
  const { error } = await (supabase.from("visits" as any) as any).update(mapped).eq("id", id);
  if (error) throw error;
};

export const deleteVisit = async (id: string): Promise<void> => {
  const { error } = await (supabase.from("visits" as any) as any).delete().eq("id", id);
  if (error) throw error;
};
