import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return jsonResponse({ status: "ok", message: "mp-webhook online" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("mp-webhook missing environment variables", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });

    return jsonResponse({ status: "received", note: "server_misconfigured" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const rawBody = (await req.text()).trim();

    if (!rawBody) {
      console.error("mp-webhook received empty body");
      return jsonResponse({ status: "received", note: "empty_body" });
    }

    let body: any;

    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("mp-webhook invalid JSON body", parseError);
      return jsonResponse({ status: "received", note: "invalid_json" });
    }

    console.log("MP webhook received:", JSON.stringify(body));

    // Validate webhook signature if configured
    const xSignature = req.headers.get("x-signature");
    const xRequestId = req.headers.get("x-request-id");

    if (xSignature && body?.data?.id) {
      const { data: allSettingsForSig } = await supabase
        .from("mercado_pago_settings")
        .select("webhook_secret")
        .eq("is_active", true)
        .neq("webhook_secret", "");

      const secrets = (allSettingsForSig || [])
        .map((s: any) => s.webhook_secret)
        .filter(Boolean);

      if (secrets.length > 0) {
        // Parse x-signature: ts=...,v1=...
        const parts: Record<string, string> = {};
        for (const part of xSignature.split(",")) {
          const [key, ...val] = part.split("=");
          parts[key.trim()] = val.join("=").trim();
        }
        const ts = parts["ts"];
        const v1 = parts["v1"];

        if (ts && v1) {
          const dataId = String(body.data.id);
          const manifest = `id:${dataId};request-id:${xRequestId || ""};ts:${ts};`;

          let signatureValid = false;
          for (const secret of secrets) {
            try {
              const encoder = new TextEncoder();
              const key = await crypto.subtle.importKey(
                "raw",
                encoder.encode(secret),
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign"]
              );
              const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
              const hexHash = Array.from(new Uint8Array(sig))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

              if (hexHash === v1) {
                signatureValid = true;
                break;
              }
            } catch (hmacErr) {
              console.error("HMAC validation error", hmacErr);
            }
          }

          if (!signatureValid) {
            console.error("mp-webhook signature mismatch", { xSignature, xRequestId });
            return jsonResponse({ status: "received", note: "invalid_signature" });
          }

          console.log("mp-webhook signature validated successfully");
        }
      }
    }

    const { type, data: webhookData, action } = body ?? {};

    if (type !== "payment" && action !== "payment.updated" && action !== "payment.created") {
      return jsonResponse({ status: "received" });
    }

    const mpPaymentId = webhookData?.id;

    if (!mpPaymentId) {
      console.error("MP webhook without payment id", body);
      return jsonResponse({ status: "received", note: "missing_payment_id" });
    }

    const { data: allSettings, error: settingsError } = await supabase
      .from("mercado_pago_settings")
      .select("*")
      .eq("is_active", true);

    if (settingsError) {
      console.error("Error loading MP settings:", settingsError);
      return jsonResponse({ status: "received", note: "settings_lookup_failed" });
    }

    if (!allSettings || allSettings.length === 0) {
      console.error("No active MP settings found");
      return jsonResponse({ status: "received", note: "mp_not_configured" });
    }

    let paymentData: any = null;

    for (const settings of allSettings) {
      try {
        const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
          headers: { Authorization: `Bearer ${settings.access_token}` },
        });

        if (paymentRes.ok) {
          paymentData = await paymentRes.json();
          break;
        }

        console.error("Mercado Pago payment lookup failed", {
          mpPaymentId: String(mpPaymentId),
          status: paymentRes.status,
          userId: settings.user_id,
        });
      } catch (lookupError) {
        console.error("Mercado Pago payment lookup error", lookupError);
      }
    }

    if (!paymentData) {
      console.error("Could not fetch payment from MP", { mpPaymentId: String(mpPaymentId) });
      return jsonResponse({ status: "received", note: "payment_not_found" });
    }

    const externalReference = paymentData.external_reference;
    const mpStatus = paymentData.status;
    const paidAmount = Number(paymentData.transaction_amount) || 0;

    if (!externalReference) {
      console.error("No external_reference in payment", { mpPaymentId: String(mpPaymentId) });
      return jsonResponse({ status: "received", note: "no_external_reference" });
    }

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", externalReference)
      .maybeSingle();

    if (contractError) {
      console.error("Error loading contract for payment", contractError);
      return jsonResponse({ status: "received", note: "contract_lookup_failed" });
    }

    if (!contract) {
      console.error("Contract not found for external_reference:", externalReference);
      return jsonResponse({ status: "received", note: "contract_not_found" });
    }

    const { data: existingLog, error: existingLogError } = await supabase
      .from("mp_payment_logs")
      .select("id")
      .eq("contract_id", contract.id)
      .eq("mp_payment_id", String(mpPaymentId))
      .eq("status", mpStatus)
      .maybeSingle();

    if (existingLogError) {
      console.error("Error checking existing MP log", existingLogError);
    }

    if (existingLog) {
      console.log("Payment already processed, skipping:", mpPaymentId, mpStatus);
      return jsonResponse({ status: "received", skipped: "already_processed" });
    }

    if (contract.status === "cancelled") {
      console.log("Contract is cancelled, logging but not updating:", contract.id);

      const { error: cancelledLogError } = await supabase.from("mp_payment_logs").insert({
        user_id: contract.user_id,
        contract_id: contract.id,
        mp_payment_id: String(mpPaymentId),
        status: `${mpStatus}_ignored_cancelled`,
        amount: paidAmount,
        raw_payload: paymentData,
      });

      if (cancelledLogError) {
        console.error("Error logging cancelled contract payment", cancelledLogError);
      }

      return jsonResponse({ status: "received", skipped: "contract_cancelled" });
    }

    const { error: logInsertError } = await supabase.from("mp_payment_logs").insert({
      user_id: contract.user_id,
      contract_id: contract.id,
      mp_payment_id: String(mpPaymentId),
      status: mpStatus,
      amount: paidAmount,
      raw_payload: paymentData,
    });

    if (logInsertError) {
      console.error("Error inserting MP payment log", logInsertError);
    }

    if (mpStatus === "approved") {
      const { data: existingPayments, error: existingPaymentsError } = await supabase
        .from("payments")
        .select("amount, description")
        .eq("contract_id", contract.id);

      if (existingPaymentsError) {
        console.error("Error loading existing payments", existingPaymentsError);
      }

      const alreadyHasMpPayment = (existingPayments || []).some(
        (p: any) => p.description?.includes(`MP#${mpPaymentId}`)
      );

      if (!alreadyHasMpPayment) {
        const today = new Date().toISOString().split("T")[0];

        const { error: insertPaymentError } = await supabase.from("payments").insert({
          user_id: contract.user_id,
          contract_id: contract.id,
          amount: paidAmount,
          date: today,
          description: `Pagamento via Cartão (Mercado Pago) - MP#${mpPaymentId}`,
        });

        if (insertPaymentError) {
          console.error("Error inserting payment", insertPaymentError);
          return jsonResponse({ status: "received", note: "payment_insert_failed" });
        }

        const { data: allPayments, error: allPaymentsError } = await supabase
          .from("payments")
          .select("amount")
          .eq("contract_id", contract.id);

        if (allPaymentsError) {
          console.error("Error recalculating payments", allPaymentsError);
          return jsonResponse({ status: "received", note: "payment_recalc_failed" });
        }

        const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const contractTotal = Number(contract.total_value);
        const remaining = Math.max(0, contractTotal - totalPaid);

        let paymentStatus = "pending";
        if (remaining <= 0) paymentStatus = "paid_full";
        else if (totalPaid > 0) paymentStatus = "deposit_paid";

        const { error: updateContractError } = await supabase
          .from("contracts")
          .update({
            remaining_value: remaining,
            payment_status: paymentStatus,
            mp_payment_id: String(mpPaymentId),
            mp_payment_status: "approved",
          })
          .eq("id", contract.id);

        if (updateContractError) {
          console.error("Error updating approved contract payment state", updateContractError);
        }

        try {
          const fmtVal = `R$ ${paidAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("name")
            .eq("id", contract.client_id)
            .maybeSingle();

          if (clientError) {
            console.error("Error loading client for push notification", clientError);
          }

          await fetch(`${supabaseUrl}/functions/v1/manage-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              action: "send-notification",
              title: "💳 Pagamento aprovado via Mercado Pago!",
              body: `${clientData?.name || "Cliente"} pagou ${fmtVal} com cartão. ${paymentStatus === "paid_full" ? "Contrato quitado!" : "Sinal confirmado!"}`,
              url: "/contracts",
              tag: `mp-approved-${contract.id}`,
            }),
          });
        } catch (pushError) {
          console.error("Push error:", pushError);
        }
      }
    } else if (mpStatus === "pending" || mpStatus === "in_process") {
      const { error: pendingUpdateError } = await supabase
        .from("contracts")
        .update({
          mp_payment_id: String(mpPaymentId),
          mp_payment_status: "pending",
        })
        .eq("id", contract.id);

      if (pendingUpdateError) {
        console.error("Error updating pending MP payment status", pendingUpdateError);
      }
    } else if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded") {
      const { error: rejectedUpdateError } = await supabase
        .from("contracts")
        .update({
          mp_payment_id: String(mpPaymentId),
          mp_payment_status: mpStatus,
        })
        .eq("id", contract.id);

      if (rejectedUpdateError) {
        console.error("Error updating rejected MP payment status", rejectedUpdateError);
      }
    }

    return jsonResponse({ status: "received", mp_status: mpStatus });
  } catch (e) {
    console.error("mp-webhook error:", e);
    return jsonResponse({ status: "received", note: "internal_error" });
  }
});