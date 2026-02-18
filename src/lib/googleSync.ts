import { supabase } from "@/integrations/supabase/client";

/**
 * Trigger Google Calendar sync for a contract.
 * Called whenever a contract status or payment status changes.
 * Silently fails if Google is not connected.
 */
export async function triggerGoogleSync(contractId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Check if user has Google connected (quick check)
    const { data: settings } = await supabase
      .from("google_settings" as never)
      .select("is_connected")
      .eq("user_id", session.user.id)
      .single();

    if (!settings || !(settings as { is_connected: boolean }).is_connected) return;

    // Fire and forget — don't block UI
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "sync-contract", contract_id: contractId }),
      }
    ).catch(() => {/* silent */});
  } catch {
    // silent fail
  }
}
