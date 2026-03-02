import { supabase } from "@/integrations/supabase/client";

const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  return user.id;
};

export interface Visit {
  id: string;
  clientName: string;
  clientPhone: string;
  interestEventDate: string | null;
  visitDate: string;
  visitTime: string;
  notes: string;
  status: string;
  googleEventId: string | null;
  createdAt: string;
  updatedAt: string;
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
    googleEventId: row.google_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
}): Promise<Visit> => {
  const userId = await getUserId();
  const { data, error } = await (supabase.from("visits" as any) as any)
    .insert({
      user_id: userId,
      client_name: v.clientName,
      client_phone: v.clientPhone,
      interest_event_date: v.interestEventDate || null,
      visit_date: v.visitDate,
      visit_time: v.visitTime,
      notes: v.notes,
    })
    .select()
    .single();
  if (error) throw error;
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
