import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    // Find contracts where:
    // - reserved_until has passed
    // - status is NOT signed/confirmed/cancelled/expired
    // - payment_status is NOT paid_full
    const { data: expiredContracts, error: fetchErr } = await supabase
      .from("contracts")
      .select("id, user_id, google_event_id, status, payment_status, reserved_until")
      .not("status", "in", '("signed","confirmed","cancelled","expired")')
      .lt("reserved_until", now)
      .not("reserved_until", "is", null);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredContracts || expiredContracts.length === 0) {
      return new Response(JSON.stringify({ expired: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let expiredCount = 0;

    for (const contract of expiredContracts) {
      // Additional check: if signed AND deposit paid, don't expire
      if (contract.status === "signed" && contract.payment_status !== "pending") {
        continue;
      }

      // Mark as expired
      const { error: updateErr } = await supabase
        .from("contracts")
        .update({
          status: "expired",
          cancelled_at: now,
          cancelled_by: "sistema_automatico",
        })
        .eq("id", contract.id);

      if (updateErr) {
        console.error(`Failed to expire contract ${contract.id}:`, updateErr);
        continue;
      }

      // Delete Google Calendar event if exists
      if (contract.google_event_id) {
        try {
          const { data: googleSettings } = await supabase
            .from("google_settings")
            .select("*")
            .eq("user_id", contract.user_id)
            .eq("is_connected", true)
            .single();

          if (googleSettings?.access_token && googleSettings?.calendar_id) {
            // Refresh token if needed
            let accessToken = googleSettings.access_token;
            const tokenExpires = googleSettings.token_expires_at ? new Date(googleSettings.token_expires_at) : null;
            if (tokenExpires && tokenExpires < new Date() && googleSettings.refresh_token) {
              const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
              const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
              const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: clientId,
                  client_secret: clientSecret,
                  refresh_token: googleSettings.refresh_token,
                  grant_type: "refresh_token",
                }),
              });
              if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                accessToken = tokenData.access_token;
                await supabase.from("google_settings").update({
                  access_token: accessToken,
                  token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
                }).eq("id", googleSettings.id);
              }
            }

            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleSettings.calendar_id)}/events/${contract.google_event_id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );

            await supabase.from("contracts").update({ google_event_id: null }).eq("id", contract.id);
          }
        } catch (e) {
          console.warn(`Failed to delete Google event for ${contract.id}:`, e);
        }
      }

      expiredCount++;
    }

    console.log(`Expired ${expiredCount} contracts`);

    return new Response(JSON.stringify({ expired: expiredCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
