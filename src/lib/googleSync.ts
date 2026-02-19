import { supabase } from "@/integrations/supabase/client";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`;

async function getSessionHeaders(): Promise<{ headers: Record<string, string>; session: { access_token: string } } | null> {
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

async function isGoogleConnected(userId: string): Promise<boolean> {
  const { data: settings } = await supabase
    .from("google_settings" as never)
    .select("is_connected")
    .eq("user_id", userId)
    .single();
  return !!(settings as { is_connected: boolean } | null)?.is_connected;
}

/**
 * Trigger Google Calendar sync for a contract.
 * Called whenever a contract status or payment status changes (not cancelled).
 * Silently fails if Google is not connected.
 */
export async function triggerGoogleSync(contractId: string): Promise<void> {
  try {
    const ctx = await getSessionHeaders();
    if (!ctx) return;
    if (!await isGoogleConnected(ctx.session.access_token ? (await supabase.auth.getUser()).data.user?.id ?? "" : "")) return;
    // Fire and forget — don't block UI
    fetch(EDGE_URL, {
      method: "POST",
      headers: ctx.headers,
      body: JSON.stringify({ action: "sync-contract", contract_id: contractId }),
    }).catch(() => {/* silent */});
  } catch {
    // silent fail
  }
}

/**
 * Delete a Google Calendar event when a contract is cancelled.
 * Clears google_event_id on the contract. Silently fails.
 */
export async function deleteGoogleEvent(contractId: string): Promise<void> {
  try {
    const ctx = await getSessionHeaders();
    if (!ctx) return;
    // Always attempt delete (edge function handles "not connected" gracefully)
    fetch(EDGE_URL, {
      method: "POST",
      headers: ctx.headers,
      body: JSON.stringify({ action: "delete-event", contract_id: contractId }),
    }).catch(() => {/* silent */});
  } catch {
    // silent fail
  }
}
