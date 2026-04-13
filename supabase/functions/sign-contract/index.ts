import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseUserAgent(ua: string): { deviceType: string; os: string; browser: string } {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const deviceType = isMobile ? "mobile" : "desktop";

  let os = "Desconhecido";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Desconhecido";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  return { deviceType, os, browser };
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return new TextDecoder().decode(hexEncode(hashArray));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  // GET /sign-contract?token=xxx or ?slug=xxx — fetch signature data for display
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    const slug = url.searchParams.get("slug");
    
    if (!token && !slug) {
      return new Response(JSON.stringify({ error: "Token ou slug obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input format
    if (token && (token.length > 256 || !/^[a-f0-9]+$/i.test(token))) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (slug && (slug.length > 256 || !/^[a-z0-9-]+$/i.test(slug))) {
      return new Response(JSON.stringify({ error: "Slug inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase.from("contract_signatures").select("*");
    if (slug) {
      query = query.eq("slug", slug);
    } else {
      query = query.eq("token", token!);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if contract is cancelled or fetch reserved_until (only if there's a contract_id)
    let contractReservedUntil: string | null = null;
    if (data.contract_id) {
      const { data: contract } = await supabase
        .from("contracts")
        .select("status, reserved_until, event_time")
        .eq("id", data.contract_id)
        .maybeSingle();
      
      if (contract && contract.status === "cancelled") {
        return new Response(JSON.stringify({ error: "Este contrato foi cancelado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (contract) {
        contractReservedUntil = contract.reserved_until || null;
      }
    }

    // Get event_time from the contract query we already did
    let eventTime = "";
    if (data.contract_id) {
      // Re-use the contract data from above query (already includes event_time)
      const { data: contractForTime } = await supabase
        .from("contracts")
        .select("event_time")
        .eq("id", data.contract_id)
        .maybeSingle();
      eventTime = contractForTime?.event_time || "";
    }

    // Mask sensitive fields before returning
    const safeData = {
      ...data,
      client_cpf: data.client_cpf ? data.client_cpf.replace(/^(\d{3}).*(\d{2})$/, "$1.***.***-$2") : null,
      client_phone: data.client_phone ? data.client_phone.replace(/^(.{4}).*(.{2})$/, "$1*****$2") : null,
      reserved_until: contractReservedUntil,
      event_time: eventTime,
    };

    return new Response(JSON.stringify(safeData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PATCH /sign-contract — save payment choice after signing
  if (req.method === "PATCH") {
    const body = await req.json();
    const { token, payment_choice, payment_method_selected, payment_due_date } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sig, error: fetchErr } = await supabase
      .from("contract_signatures")
      .select("contract_id, user_id, client_name, total_value, deposit_percent")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr || !sig) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update contract_signatures
    await supabase.from("contract_signatures").update({
      payment_choice: payment_choice || "",
      payment_method_selected: payment_method_selected || "",
      payment_due_date: payment_due_date || null,
    }).eq("token", token);

    // Update contracts table
    if (sig.contract_id) {
      const updateData: Record<string, any> = {
        payment_choice: payment_choice || "",
        payment_method_selected: payment_method_selected || "",
      };
      if (payment_due_date) {
        updateData.payment_due_date = payment_due_date;
      }
      if (payment_choice === "pagar_depois") {
        updateData.payment_followup_required = true;
      }
      await supabase.from("contracts").update(updateData).eq("id", sig.contract_id);

      // Send push notification for "pay later"
      if (payment_choice === "pagar_depois") {
        try {
          const depositValue = (Number(sig.total_value) * Number(sig.deposit_percent)) / 100;
          const fmtVal = `R$ ${depositValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
          const methodLabel = payment_method_selected === "pix" ? "PIX" : payment_method_selected === "cartao" ? "Cartão" : payment_method_selected || "Não definido";
          const dateLabel = payment_due_date ? payment_due_date.split("-").reverse().join("/") : "não definida";

          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/manage-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({
              action: 'send-notification',
              title: '⚠️ Cliente escolheu pagar depois',
              body: `${sig.client_name} vai pagar ${fmtVal} depois. Método: ${methodLabel}. Data prometida: ${dateLabel}`,
              url: '/contracts',
              tag: `pay-later-${sig.contract_id}`
            })
          });
        } catch (e) {
          console.error("Push notification error:", e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PUT /sign-contract — upload receipt after signing
  if (req.method === "PUT") {
    const body = await req.json();
    const { token, action, file_base64, file_name, file_type, payment_method } = body;

    if (!token || action !== "upload-receipt") {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch signature record
    const { data: sig, error: fetchErr } = await supabase
      .from("contract_signatures")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr || !sig) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sig.contract_id) {
      return new Response(JSON.stringify({ error: "Contrato não vinculado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const fileBytes = decode(file_base64);
      const ext = file_name?.split(".")?.pop() || "pdf";
      const storagePath = `${sig.user_id}/${sig.contract_id}/comprovante_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBytes, {
          contentType: file_type || "application/octet-stream",
          upsert: false,
        });

      if (uploadErr) {
        console.error("Error uploading receipt:", uploadErr);
        return new Response(JSON.stringify({ error: "Erro ao enviar comprovante" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save document record
      await supabase.from("documents").insert({
        user_id: sig.user_id,
        contract_id: sig.contract_id,
        name: `Comprovante Pix - ${sig.client_name}`,
        type: "comprovante",
        file_name: storagePath,
      });

      // Try to parse receipt with AI to extract amount
      let parsedAmount: number | null = null;
      try {
        const parseRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/parse-receipt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ image_base64: file_base64, mime_type: file_type || "image/jpeg" }),
        });
        const parseResult = await parseRes.json();
        if (parseResult.receipt?.amount) {
          parsedAmount = parseResult.receipt.amount;
        }
      } catch (e) {
        console.error("Receipt parse error:", e);
      }

      // Register payment if amount was parsed or use deposit value as fallback
      const depositValue = (Number(sig.total_value) * Number(sig.deposit_percent)) / 100;
      const paymentAmount = parsedAmount || depositValue;
      const today = new Date().toISOString().split("T")[0];

      // Get current payments total
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("contract_id", sig.contract_id);
      const currentPaid = (existingPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

      // Insert payment
      await supabase.from("payments").insert({
        user_id: sig.user_id,
        contract_id: sig.contract_id,
        amount: paymentAmount,
        date: today,
        description: parsedAmount
          ? `Sinal via PIX - comprovante importado (R$ ${paymentAmount.toFixed(2)})`
          : `Sinal via PIX - comprovante enviado`,
      });

      // Update contract payment status
      const newTotalPaid = currentPaid + paymentAmount;
      const contractTotal = Number(sig.total_value);
      const newRemaining = Math.max(0, contractTotal - newTotalPaid);
      let newPaymentStatus = "pending";
      if (newTotalPaid >= contractTotal) newPaymentStatus = "paid_full";
      else if (newTotalPaid > 0) newPaymentStatus = "deposit_paid";

      await supabase.from("contracts").update({
        remaining_value: newRemaining,
        payment_status: newPaymentStatus,
        payment_choice: "pagar_agora",
        payment_method_selected: "pix",
      }).eq("id", sig.contract_id);

      // Send push notification about receipt
      try {
        const fmtVal = `R$ ${paymentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        const sinalIncompleto = newTotalPaid < depositValue;
        const pushBody = sinalIncompleto
          ? `${sig.client_name} enviou comprovante de ${fmtVal}. Sinal incompleto: faltam R$ ${(depositValue - newTotalPaid).toFixed(2)}.`
          : `${sig.client_name} enviou comprovante de ${fmtVal}. Sinal pago integralmente!`;

        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/manage-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          },
          body: JSON.stringify({
            action: 'send-notification',
            title: '💰 Comprovante PIX recebido!',
            body: pushBody,
            url: '/contracts',
            tag: `receipt-${sig.contract_id}`
          })
        });
      } catch (e) {
        console.error("Push notification error:", e);
      }

      return new Response(JSON.stringify({ 
        success: true,
        parsed_amount: parsedAmount,
        payment_registered: paymentAmount,
        remaining: newRemaining,
        payment_status: newPaymentStatus,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Receipt upload error:", e);
      return new Response(JSON.stringify({ error: "Erro ao processar comprovante" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // POST /sign-contract — client signs the contract
  if (req.method === "POST") {
    const body = await req.json();
    const { token, pdf_base64, user_agent } = body;
    if (!token || typeof token !== "string" || token.length > 256) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") || "unknown";

    // Fetch signature record
    const { data: sig, error: fetchErr } = await supabase
      .from("contract_signatures")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr || !sig) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sig.status === "signed") {
      return new Response(JSON.stringify({ error: "Contrato já foi assinado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if contract is cancelled or expired before allowing signature
    if (sig.contract_id) {
      const { data: contractCheck } = await supabase
        .from("contracts")
        .select("status, reserved_until")
        .eq("id", sig.contract_id)
        .maybeSingle();
      
      if (contractCheck && contractCheck.status === "cancelled") {
        return new Response(JSON.stringify({ error: "Este contrato foi cancelado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (contractCheck && contractCheck.status === "expired") {
        return new Response(JSON.stringify({ error: "O prazo de 24 horas para assinatura expirou. A reserva foi liberada." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Check reserved_until
      if (contractCheck && contractCheck.reserved_until) {
        const reservedUntil = new Date(contractCheck.reserved_until).getTime();
        if (Date.now() > reservedUntil) {
          return new Response(JSON.stringify({ error: "O prazo de 24 horas para assinatura expirou. A reserva foi liberada." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const now = new Date().toISOString();
    const isBudget = !sig.contract_id && sig.budget_id;
    const docLabel = isBudget ? "Orçamento" : "Contrato";
    const signedFileName = `${docLabel} Lamoniê – ${sig.client_name} – Assinado.pdf`;
    const refId = sig.contract_id || sig.budget_id || "unknown";
    const storagePath = `${sig.user_id}/${refId}/${Date.now()}.pdf`;

    let pdfUploaded = false;
    let pdfHash: string | null = null;
    let pdfBytes: Uint8Array | null = null;

    // Upload signed PDF to storage if provided
    if (pdf_base64) {
      try {
        const base64Data = pdf_base64.includes(",") ? pdf_base64.split(",")[1] : pdf_base64;
        pdfBytes = decode(base64Data);

        // Compute SHA-256 hash
        pdfHash = await sha256Hex(pdfBytes);

        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadErr) {
          console.error("Error uploading signed PDF:", uploadErr);
        } else {
          // Save document record (only if contract_id exists)
          if (sig.contract_id) {
            const { error: docErr } = await supabase
              .from("documents")
              .insert({
                user_id: sig.user_id,
                contract_id: sig.contract_id,
                name: signedFileName,
                type: "contrato",
                file_name: storagePath,
              });

            if (docErr) {
              console.error("Error saving signed document record:", docErr);
            } else {
              pdfUploaded = true;
            }
          } else {
            // Budget signature - update budget with pdf_url
            if (sig.budget_id) {
              await supabase.from("budgets").update({ pdf_url: storagePath }).eq("id", sig.budget_id);
            }
            pdfUploaded = true;
          }
        }
      } catch (e) {
        console.error("Error processing PDF upload:", e);
      }
    }

    // Only mark as signed if PDF was successfully stored
    if (!pdfUploaded) {
      return new Response(JSON.stringify({ error: "Falha ao salvar o PDF assinado. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update signature record
    const { error: updateSigErr } = await supabase
      .from("contract_signatures")
      .update({
        status: "signed",
        signed_at: now,
        signed_ip: clientIp,
      })
      .eq("token", token);

    if (updateSigErr) {
      return new Response(JSON.stringify({ error: "Erro ao registrar assinatura" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update contract/budget status
    if (sig.contract_id) {
      await supabase
        .from("contracts")
        .update({ status: "signed" })
        .eq("id", sig.contract_id);

      // Trigger Google Calendar sync to update status in the event description
      try {
        const { data: gSettings } = await supabase
          .from("google_settings")
          .select("*")
          .eq("user_id", sig.user_id)
          .single();

        if (gSettings?.is_connected) {
          const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
          const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

          let accessToken = gSettings.access_token;
          const expiresAt = gSettings.token_expires_at ? new Date(gSettings.token_expires_at) : null;
          if (!expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
            if (gSettings.refresh_token) {
              const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: GOOGLE_CLIENT_ID,
                  client_secret: GOOGLE_CLIENT_SECRET,
                  refresh_token: gSettings.refresh_token,
                  grant_type: "refresh_token",
                }),
              });
              const tokens = await tokenRes.json();
              if (tokenRes.ok && tokens.access_token) {
                accessToken = tokens.access_token;
                await supabase.from("google_settings").update({
                  access_token: tokens.access_token,
                  token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
                }).eq("user_id", sig.user_id);
              }
            }
          }

          if (accessToken) {
            const { data: updatedContract } = await supabase.from("contracts").select("*").eq("id", sig.contract_id).single();
            const { data: client } = await supabase.from("clients").select("*").eq("id", updatedContract.client_id).single();

            if (updatedContract && client && updatedContract.google_event_id) {
              const calendarId = gSettings.calendar_id || "primary";
              const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
              const contractStatusLabels: Record<string, string> = {
                awaiting_documents: "Aguardando Documentos", awaiting_signature: "Aguardando Assinatura",
                signed: "Assinado", confirmed: "Confirmado", cancelled: "Cancelado",
              };
              const paymentStatusLabels: Record<string, string> = {
                pending: "Pendente", deposit_paid: "Sinal Pago", paid_full: "Pago Total",
              };
              const rentalType = updatedContract.rental_type || "Locação (1 dia)";
              const dateInfo = updatedContract.event_date_end
                ? `📅 Datas: ${updatedContract.event_date} a ${updatedContract.event_date_end}`
                : `📅 Data: ${updatedContract.event_date}`;
              const description = [
                `🎉 ${updatedContract.event_type}`, ``,
                `👤 Cliente: ${client.name}`, `📄 CPF: ${client.cpf || "—"}`, `📞 Telefone: ${client.phone || "—"}`, ``,
                `🏠 Modalidade: ${rentalType}`, dateInfo, ``,
                `💰 Valor Total: ${fmtCurrency(Number(updatedContract.total_value))}`,
                `💵 Sinal (${updatedContract.deposit_percent}%): ${fmtCurrency(Number(updatedContract.deposit_value))}`,
                `📋 Restante: ${fmtCurrency(Number(updatedContract.remaining_value))}`, ``,
                `📊 Status Contrato: ${contractStatusLabels[updatedContract.status] || updatedContract.status}`,
                `💳 Status Pagamento: ${paymentStatusLabels[updatedContract.payment_status] || updatedContract.payment_status}`, ``,
                `🆔 ID Contrato: ${updatedContract.id}`, ``, `— Criado automaticamente pelo CRM Lamoniê`,
              ].join("\n");

              const PAYMENT_COLOR_IDS: Record<string, string> = { pending: "5", deposit_paid: "2", paid_full: "10", cancelled: "8" };
              const colorId = PAYMENT_COLOR_IDS[updatedContract.payment_status] || "5";
              const baseEndDate = updatedContract.event_date_end || updatedContract.event_date;
              const endDate = new Date(baseEndDate + "T12:00:00");
              endDate.setDate(endDate.getDate() + 1);

              const eventBody = {
                summary: `Lamoniê — ${client.name} — ${updatedContract.event_type}`,
                description,
                location: "Espaço Lamoniê — Endereço do espaço",
                start: { date: updatedContract.event_date },
                end: { date: endDate.toISOString().split("T")[0] },
                colorId,
                extendedProperties: { private: { contract_id: updatedContract.id, crm: "lamonie" } },
              };

              await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${updatedContract.google_event_id}`,
                { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(eventBody) }
              );
            }
          }
        }
      } catch (syncErr) {
        console.error("Google Calendar sync after signature failed:", syncErr);
      }
    } else if (sig.budget_id) {
      // Update budget status to "converted" when signed
      await supabase
        .from("budgets")
        .update({ status: "converted" })
        .eq("id", sig.budget_id);
    }

    // Create audit log entry (only for contracts)
    if (sig.contract_id) {
      const uaString = user_agent || req.headers.get("user-agent") || "";
      const { deviceType, os, browser } = parseUserAgent(uaString);

      const { error: auditErr } = await supabase
        .from("signature_audit_logs")
        .insert({
          contract_id: sig.contract_id,
          client_name: sig.client_name,
          client_cpf: sig.client_cpf,
          signed_file_name: signedFileName,
          signature_type: "rubrica_manual",
          signed_at: now,
          read_confirmed: true,
          signer_ip: clientIp,
          device_type: deviceType,
          operating_system: os,
          browser: browser,
          user_agent: uaString,
          pdf_hash: pdfHash,
          contract_version: 1,
          user_id: sig.user_id,
        });

      if (auditErr) {
        console.error("Error creating audit log:", auditErr);
      }
    }

    // 🔔 Send push notification
    try {
      const label = isBudget ? "orçamento" : "contrato";
      const notificationPayload = {
        action: 'send-notification',
        title: isBudget ? '✅ Orçamento Assinado!' : '✅ Contrato Assinado!',
        body: `${sig.client_name} assinou o ${label} para ${sig.event_date.split('-').reverse().join('/')}.`,
        url: isBudget ? '/budgets' : '/contracts',
        tag: `signature-${refId}`
      };

      const pushResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/manage-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify(notificationPayload)
      });

      if (!pushResponse.ok) {
        console.error("Failed to send push notification:", await pushResponse.text());
      } else {
        console.log(`✅ Push notification sent for ${label} signature`);
      }
    } catch (pushErr) {
      console.error("Error sending push notification:", pushErr);
    }

    return new Response(JSON.stringify({ success: true, signed_at: now }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
