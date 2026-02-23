import { supabase } from "@/integrations/supabase/client";

// ─── Connection ───

export interface WhatsAppConnection {
  id: string;
  waha_url: string;
  waha_api_key: string;
  session_name: string;
  status: string;
  connected_phone: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
}

export async function getConnection(): Promise<WhatsAppConnection | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("whatsapp_connection")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as any;
}

export async function upsertConnection(conn: Partial<WhatsAppConnection>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const existing = await getConnection();
  if (existing) {
    await supabase
      .from("whatsapp_connection")
      .update({ ...conn, updated_at: new Date().toISOString() } as any)
      .eq("id", existing.id);
  } else {
    await supabase.from("whatsapp_connection").insert({
      user_id: user.id,
      ...conn,
    });
  }
}

// Check WAHA status
export async function checkWahaStatus(wahaUrl: string, apiKey: string, session: string): Promise<{
  status: string;
  phone?: string;
}> {
  try {
    const res = await fetch(`${wahaUrl}/api/sessions/${session}`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "ngrok-skip-browser-warning": "true" },
    });
    if (!res.ok) return { status: "disconnected" };
    const data = await res.json();
    return {
      status: data.status === "WORKING" ? "connected" : data.status?.toLowerCase() || "disconnected",
      phone: data.me?.id?.split("@")?.[0],
    };
  } catch {
    return { status: "error" };
  }
}

// Get QR Code from WAHA
export async function getWahaQR(wahaUrl: string, apiKey: string, session: string): Promise<string | null> {
  try {
    const res = await fetch(`${wahaUrl}/api/${session}/auth/qr`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "ngrok-skip-browser-warning": "true" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value || null;
  } catch {
    return null;
  }
}

// Start WAHA session
export async function startWahaSession(wahaUrl: string, apiKey: string, session: string, webhookUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${wahaUrl}/api/sessions/start`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        name: session,
        config: {
          webhooks: [{ url: webhookUrl, events: ["message", "session.status"] }],
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Send message via WAHA
export async function sendWahaMessage(wahaUrl: string, apiKey: string, session: string, phone: string, text: string): Promise<boolean> {
  try {
    const chatId = phone.replace(/\D/g, "") + "@c.us";
    const res = await fetch(`${wahaUrl}/api/sendText`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ session, chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Messages ───

export interface WhatsAppMessage {
  id: string;
  lead_id: string;
  direction: string;
  body: string;
  timestamp: string;
  status: string;
}

export async function getMessages(leadId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });

  if (error) throw error;
  return (data || []) as any;
}

export async function addMessage(msg: {
  lead_id: string;
  direction: string;
  body: string;
  status?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("whatsapp_messages").insert({
    user_id: user.id,
    lead_id: msg.lead_id,
    direction: msg.direction,
    body: msg.body,
    status: msg.status || "sent",
  });
  if (error) throw error;
}

// ─── Logs ───

export interface WhatsAppLog {
  id: string;
  event_type: string;
  message: string;
  details: any;
  created_at: string;
}

export async function getLogs(): Promise<WhatsAppLog[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("whatsapp_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as any;
}

export async function addLog(log: {
  event_type: string;
  message: string;
  details?: any;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  await supabase.from("whatsapp_logs").insert({
    user_id: user.id,
    ...log,
  });
}

// ─── Automation Rules ───

export interface AutomationRule {
  id: string;
  stage_id: string;
  auto_message_template_key: string | null;
  auto_send: boolean;
  followup_after_hours: number | null;
  followup_template_key: string | null;
  enabled: boolean;
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("stage_automation_rules")
    .select("*")
    .eq("user_id", user.id);

  if (error) throw error;
  return (data || []) as any;
}

export async function upsertAutomationRule(rule: Partial<AutomationRule> & { stage_id: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  if (rule.id) {
    await supabase
      .from("stage_automation_rules")
      .update({ ...rule, updated_at: new Date().toISOString() } as any)
      .eq("id", rule.id);
  } else {
    await supabase.from("stage_automation_rules").insert({
      user_id: user.id,
      ...rule,
    });
  }
}
