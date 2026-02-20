import { supabase } from "@/integrations/supabase/client";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`;

async function getSessionHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    session,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  };
}

export async function syncVisitToGoogle(visitId: string): Promise<void> {
  try {
    const ctx = await getSessionHeaders();
    if (!ctx) return;
    fetch(EDGE_URL, {
      method: "POST",
      headers: ctx.headers,
      body: JSON.stringify({ action: "sync-visit", visit_id: visitId }),
    }).catch(() => {});
  } catch {}
}

export async function deleteVisitGoogleEvent(visitId: string): Promise<void> {
  try {
    const ctx = await getSessionHeaders();
    if (!ctx) return;
    fetch(EDGE_URL, {
      method: "POST",
      headers: ctx.headers,
      body: JSON.stringify({ action: "delete-visit-event", visit_id: visitId }),
    }).catch(() => {});
  } catch {}
}
