import { supabase } from "@/integrations/supabase/client";

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`;

async function getSessionHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  };
}

/**
 * Trigger Google Calendar sync for a contract.
 * Called whenever a contract is created, edited, or status changes (not cancelled).
 * The edge function itself checks if Google is connected — no local pre-check needed.
 */
export async function triggerGoogleSync(contractId: string): Promise<void> {
  try {
    const ctx = await getSessionHeaders();
    if (!ctx) return;
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
