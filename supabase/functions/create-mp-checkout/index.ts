import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { contract_id, token } = body;

    if (!contract_id || !token) {
      return new Response(JSON.stringify({ error: "contract_id e token são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch signature to get user_id
    const { data: sig, error: sigErr } = await supabase
      .from("contract_signatures")
      .select("user_id, client_name, total_value, deposit_percent, contract_id")
      .eq("token", token)
      .maybeSingle();

    if (sigErr || !sig) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contract details
    const { data: contract, error: contractErr } = await supabase
      .from("contracts")
      .select("id, client_id, event_type, event_date, total_value, deposit_percent, deposit_value, status, mp_preference_id")
      .eq("id", contract_id)
      .maybeSingle();

    if (contractErr || !contract) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contract.status === "cancelled" || contract.status === "expired") {
      return new Response(JSON.stringify({ error: "Contrato cancelado ou expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If preference already exists, return it
    if (contract.mp_preference_id) {
      return new Response(JSON.stringify({ 
        preference_id: contract.mp_preference_id,
        init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${contract.mp_preference_id}`,
        already_exists: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch MP settings
    const { data: mpSettings } = await supabase
      .from("mercado_pago_settings")
      .select("*")
      .eq("user_id", sig.user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!mpSettings || !mpSettings.access_token) {
      return new Response(JSON.stringify({ error: "Mercado Pago não configurado. Configure nas configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client name
    const { data: client } = await supabase
      .from("clients")
      .select("name, email, phone")
      .eq("id", contract.client_id)
      .maybeSingle();

    const depositValue = Number(contract.deposit_value) || (Number(contract.total_value) * Number(contract.deposit_percent)) / 100;
    const externalReference = contract.id;

    // Build back_urls for payment result pages
    const siteUrl = "https://espacolamonie.lovable.app";
    const backUrls: Record<string, string> = {
      success: mpSettings.success_url || `${siteUrl}/pagamento/sucesso`,
      failure: mpSettings.failure_url || `${siteUrl}/pagamento/falha`,
      pending: mpSettings.pending_url || `${siteUrl}/pagamento/pendente`,
    };

    // Create Mercado Pago preference
    const preferencePayload: Record<string, any> = {
      items: [
        {
          title: `Sinal - ${contract.event_type} - Espaço Lamoniê`,
          description: `Sinal do contrato para ${client?.name || sig.client_name} - ${contract.event_type} em ${contract.event_date}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: depositValue,
        },
      ],
      external_reference: externalReference,
      notification_url: mpSettings.webhook_url || `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
      auto_return: "approved",
      back_urls: backUrls,
    };

    if (client?.email) {
      preferencePayload.payer = { email: client.email };
    }

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpSettings.access_token}`,
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP API error:", mpData);
      return new Response(JSON.stringify({ error: "Erro ao criar checkout no Mercado Pago", details: mpData.message || mpData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save preference ID and external reference in contract
    await supabase.from("contracts").update({
      mp_preference_id: mpData.id,
      mp_external_reference: externalReference,
      payment_method_selected: "cartao",
      payment_choice: "pagar_agora",
    }).eq("id", contract.id);

    // Log the creation
    await supabase.from("mp_payment_logs").insert({
      user_id: sig.user_id,
      contract_id: contract.id,
      mp_payment_id: "",
      status: "preference_created",
      amount: depositValue,
      raw_payload: { preference_id: mpData.id, init_point: mpData.init_point },
    });

    return new Response(JSON.stringify({
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("create-mp-checkout error:", e);
    return new Response(JSON.stringify({ error: "Erro interno ao criar checkout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
