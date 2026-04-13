import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET for health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", message: "mp-webhook online" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ status: "received", note: "empty or invalid body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("MP webhook received:", JSON.stringify(body));

    // Mercado Pago sends { action, type, data: { id } }
    const { type, data: webhookData, action } = body;

    // Only process payment notifications
    if (type !== "payment" && action !== "payment.updated" && action !== "payment.created") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpPaymentId = webhookData?.id;
    if (!mpPaymentId) {
      return new Response(JSON.stringify({ error: "Payment ID não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We need the access_token. Since webhook doesn't tell us which user,
    // we'll try to find it from the external_reference after fetching the payment.
    // First, try all active MP settings to find the right one
    const { data: allSettings } = await supabase
      .from("mercado_pago_settings")
      .select("*")
      .eq("is_active", true);

    if (!allSettings || allSettings.length === 0) {
      console.error("No active MP settings found");
      return new Response(JSON.stringify({ error: "MP não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let paymentData: any = null;
    let usedSettings: any = null;

    // Try each settings to fetch the payment
    for (const settings of allSettings) {
      try {
        const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
          headers: { Authorization: `Bearer ${settings.access_token}` },
        });
        if (paymentRes.ok) {
          paymentData = await paymentRes.json();
          usedSettings = settings;
          break;
        }
      } catch {}
    }

    if (!paymentData) {
      console.error("Could not fetch payment from MP");
      return new Response(JSON.stringify({ error: "Pagamento não encontrado no Mercado Pago" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalReference = paymentData.external_reference;
    const mpStatus = paymentData.status; // approved, pending, rejected, cancelled, etc.
    const paidAmount = Number(paymentData.transaction_amount) || 0;

    if (!externalReference) {
      console.error("No external_reference in payment");
      return new Response(JSON.stringify({ received: true, skipped: "no external_reference" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find contract by external_reference (which is the contract ID)
    const { data: contract } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", externalReference)
      .maybeSingle();

    if (!contract) {
      console.error("Contract not found for external_reference:", externalReference);
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: check if we already processed this payment
    const { data: existingLog } = await supabase
      .from("mp_payment_logs")
      .select("id")
      .eq("contract_id", contract.id)
      .eq("mp_payment_id", String(mpPaymentId))
      .eq("status", mpStatus)
      .maybeSingle();

    if (existingLog) {
      console.log("Payment already processed, skipping:", mpPaymentId, mpStatus);
      return new Response(JSON.stringify({ received: true, skipped: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Don't reactivate cancelled contracts
    if (contract.status === "cancelled") {
      console.log("Contract is cancelled, logging but not updating:", contract.id);
      await supabase.from("mp_payment_logs").insert({
        user_id: contract.user_id,
        contract_id: contract.id,
        mp_payment_id: String(mpPaymentId),
        status: `${mpStatus}_ignored_cancelled`,
        amount: paidAmount,
        raw_payload: paymentData,
      });
      return new Response(JSON.stringify({ received: true, skipped: "contract_cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log this webhook event
    await supabase.from("mp_payment_logs").insert({
      user_id: contract.user_id,
      contract_id: contract.id,
      mp_payment_id: String(mpPaymentId),
      status: mpStatus,
      amount: paidAmount,
      raw_payload: paymentData,
    });

    // Handle status
    if (mpStatus === "approved") {
      // Check existing payments to avoid duplicates
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("amount, description")
        .eq("contract_id", contract.id);

      const alreadyHasMpPayment = (existingPayments || []).some(
        (p: any) => p.description?.includes(`MP#${mpPaymentId}`)
      );

      if (!alreadyHasMpPayment) {
        const today = new Date().toISOString().split("T")[0];

        // Insert payment
        await supabase.from("payments").insert({
          user_id: contract.user_id,
          contract_id: contract.id,
          amount: paidAmount,
          date: today,
          description: `Pagamento via Cartão (Mercado Pago) - MP#${mpPaymentId}`,
        });

        // Recalculate totals
        const { data: allPayments } = await supabase
          .from("payments")
          .select("amount")
          .eq("contract_id", contract.id);

        const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const contractTotal = Number(contract.total_value);
        const remaining = Math.max(0, contractTotal - totalPaid);

        let paymentStatus = "pending";
        if (remaining <= 0) paymentStatus = "paid_full";
        else if (totalPaid > 0) paymentStatus = "deposit_paid";

        await supabase.from("contracts").update({
          remaining_value: remaining,
          payment_status: paymentStatus,
          mp_payment_id: String(mpPaymentId),
          mp_payment_status: "approved",
        }).eq("id", contract.id);

        // Send push notification
        try {
          const fmtVal = `R$ ${paidAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
          
          // Get client name
          const { data: clientData } = await supabase
            .from("clients")
            .select("name")
            .eq("id", contract.client_id)
            .maybeSingle();

          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/manage-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              action: "send-notification",
              title: "💳 Pagamento aprovado via Mercado Pago!",
              body: `${clientData?.name || "Cliente"} pagou ${fmtVal} com cartão. ${paymentStatus === "paid_full" ? "Contrato quitado!" : "Sinal confirmado!"}`,
              url: "/contracts",
              tag: `mp-approved-${contract.id}`,
            }),
          });
        } catch (e) {
          console.error("Push error:", e);
        }
      }
    } else if (mpStatus === "pending" || mpStatus === "in_process") {
      await supabase.from("contracts").update({
        mp_payment_id: String(mpPaymentId),
        mp_payment_status: "pending",
      }).eq("id", contract.id);
    } else if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded") {
      await supabase.from("contracts").update({
        mp_payment_id: String(mpPaymentId),
        mp_payment_status: mpStatus,
      }).eq("id", contract.id);
    }

    return new Response(JSON.stringify({ received: true, status: mpStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("mp-webhook error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
