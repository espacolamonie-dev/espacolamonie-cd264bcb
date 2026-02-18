import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GoogleSettings {
  id: string;
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  calendar_name: string | null;
  connected_at: string | null;
  connected_email: string | null;
  is_connected: boolean;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
}

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  colorId?: string;
  extendedProperties?: { private?: { contract_id?: string; crm?: string } };
}

async function callSync(action: string, extra: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...extra }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function useGoogleCalendar() {
  const [settings, setSettings] = useState<GoogleSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const data = await callSync("get-settings");
      setSettings(data.settings);
      return data.settings as GoogleSettings | null;
    } catch {
      return null;
    }
  }, []);

  const getAuthUrl = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callSync("get-auth-url");
      return data.url as string;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await callSync("disconnect");
      setSettings(null);
      toast({ title: "Google Agenda desconectado" });
    } catch (e) {
      toast({ title: "Erro ao desconectar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getCalendars = useCallback(async (): Promise<GoogleCalendarItem[]> => {
    const data = await callSync("get-calendars");
    return data.calendars || [];
  }, []);

  const setCalendar = useCallback(async (calendar_id: string, calendar_name: string) => {
    await callSync("set-calendar", { calendar_id, calendar_name });
    toast({ title: "Calendário configurado com sucesso" });
  }, [toast]);

  const syncContract = useCallback(async (contract_id: string) => {
    try {
      const data = await callSync("sync-contract", { contract_id });
      return data as { success: boolean; google_event_id?: string };
    } catch (e) {
      console.error("syncContract error:", e);
      return { success: false };
    }
  }, []);

  const fetchGoogleEvents = useCallback(async (time_min?: string, time_max?: string): Promise<GoogleEvent[]> => {
    try {
      const data = await callSync("fetch-google-events", { time_min, time_max });
      return data.events || [];
    } catch {
      return [];
    }
  }, []);

  const getSyncLogs = useCallback(async () => {
    const data = await callSync("get-sync-logs");
    return data.logs || [];
  }, []);

  return {
    settings,
    loading,
    fetchSettings,
    getAuthUrl,
    disconnect,
    getCalendars,
    setCalendar,
    syncContract,
    fetchGoogleEvents,
    getSyncLogs,
  };
}
