import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event_name, event_id, user_data, custom_data } = body;

    // Get Meta settings
    const { data: settings } = await supabase
      .from("meta_pixel_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings || !settings.capi_enabled || !settings.access_token || !settings.pixel_id) {
      return new Response(
        JSON.stringify({ error: "Meta CAPI not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user_data with hashing
    const hashedUserData: Record<string, any> = {};
    if (user_data?.phone) {
      const cleanPhone = user_data.phone.replace(/\D/g, "");
      hashedUserData.ph = [await sha256(cleanPhone)];
    }
    if (user_data?.email) {
      hashedUserData.em = [await sha256(user_data.email)];
    }
    if (user_data?.name) {
      const parts = user_data.name.trim().split(" ");
      if (parts[0]) hashedUserData.fn = [await sha256(parts[0])];
      if (parts.length > 1) hashedUserData.ln = [await sha256(parts[parts.length - 1])];
    }
    hashedUserData.country = [await sha256("br")];

    const eventPayload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id,
          action_source: "website",
          user_data: hashedUserData,
          custom_data: custom_data || {},
        },
      ],
    };

    // Send to Meta Conversions API
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${settings.pixel_id}/events?access_token=${settings.access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      }
    );

    const metaResult = await metaRes.json();
    const status = metaRes.ok ? "sent" : "error";

    // Log event
    await supabase.from("meta_event_logs").insert({
      user_id: user.id,
      event_name,
      event_id,
      status,
      error_message: metaRes.ok ? null : JSON.stringify(metaResult),
      payload: { user_data: hashedUserData, custom_data },
    });

    if (!metaRes.ok) {
      return new Response(
        JSON.stringify({ error: "Meta API error", details: metaResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, result: metaResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[meta-conversion] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
