import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const event = body.event || body.type;

    console.log("WAHA webhook event:", event, JSON.stringify(body).slice(0, 500));

    // Handle session status events
    if (event === "session.status") {
      const sessionName = body.session || "default";
      const status = body.payload?.status?.toLowerCase() || "disconnected";

      // Find connection by session name and update
      const { data: connections } = await supabase
        .from("whatsapp_connection")
        .select("id, user_id")
        .eq("session_name", sessionName);

      for (const conn of connections || []) {
        await supabase
          .from("whatsapp_connection")
          .update({
            status: status === "working" ? "connected" : status,
            ...(status === "working" ? { connected_at: new Date().toISOString() } : { disconnected_at: new Date().toISOString() }),
          })
          .eq("id", conn.id);

        await supabase.from("whatsapp_logs").insert({
          user_id: conn.user_id,
          event_type: status === "working" ? "connection" : "disconnection",
          message: `Sessão ${sessionName}: ${status}`,
          details: body,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle incoming messages
    if (event === "message" || event === "message.any") {
      const payload = body.payload || body;
      const from = payload.from || payload.chatId || "";
      const messageBody = payload.body || payload.text || "";
      const phone = from.replace("@c.us", "").replace("@s.whatsapp.net", "");
      const sessionName = body.session || "default";

      if (!phone || !messageBody) {
        return new Response(JSON.stringify({ ok: true, skipped: "no phone or body" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the connection/user for this session
      const { data: connections } = await supabase
        .from("whatsapp_connection")
        .select("user_id")
        .eq("session_name", sessionName);

      if (!connections || connections.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: "no connection found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = connections[0].user_id;

      // Find or create lead by phone
      let { data: lead } = await supabase
        .from("leads")
        .select("id, human_mode, stage")
        .eq("user_id", userId)
        .eq("phone", phone)
        .maybeSingle();

      if (!lead) {
        // Also try with formatted phone
        const formattedPhone = phone.length === 13 ? `(${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}` : phone;
        const { data: leadAlt } = await supabase
          .from("leads")
          .select("id, human_mode, stage")
          .eq("user_id", userId)
          .eq("phone", formattedPhone)
          .maybeSingle();

        if (leadAlt) {
          lead = leadAlt;
        } else {
          // Create new lead
          const { data: newLead, error: insertErr } = await supabase
            .from("leads")
            .insert({
              user_id: userId,
              name: payload.pushName || `WhatsApp ${phone}`,
              phone: phone,
              origin: "WhatsApp",
              stage: "novo_lead",
              tags: ["whatsapp"],
            })
            .select("id, human_mode, stage")
            .single();

          if (insertErr) {
            console.error("Error creating lead:", insertErr);
            return new Response(JSON.stringify({ error: insertErr.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          lead = newLead;

          // Log initial status
          await supabase.from("lead_status_history").insert({
            lead_id: lead!.id,
            from_stage: null,
            to_stage: "novo_lead",
            user_id: userId,
          });
        }
      }

      // Save message
      await supabase.from("whatsapp_messages").insert({
        user_id: userId,
        lead_id: lead!.id,
        direction: "in",
        body: messageBody,
        status: "received",
        raw_payload: body,
      });

      // Update lead last interaction
      await supabase
        .from("leads")
        .update({ last_interaction: new Date().toISOString() })
        .eq("id", lead!.id);

      // Log
      await supabase.from("whatsapp_logs").insert({
        user_id: userId,
        event_type: "message_received",
        message: `Mensagem de ${phone}: ${messageBody.slice(0, 100)}`,
        details: { lead_id: lead!.id, phone },
      });

      return new Response(JSON.stringify({ ok: true, lead_id: lead!.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
