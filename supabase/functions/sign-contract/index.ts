import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

  const url = new URL(req.url);

  // GET /sign-contract?token=xxx — fetch signature data for display
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("contract_signatures")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /sign-contract — client signs the contract
  if (req.method === "POST") {
    const body = await req.json();
    const { token, pdf_base64 } = body;
    if (!token) {
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

    const now = new Date().toISOString();

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

    // Update contract status to "signed"
    const { error: updateContractErr } = await supabase
      .from("contracts")
      .update({ status: "signed" })
      .eq("id", sig.contract_id);

    if (updateContractErr) {
      console.error("Error updating contract status:", updateContractErr);
    }

    // Upload signed PDF to storage if provided
    const signedFileName = `Contrato Lamoniê – ${sig.client_name} – Assinado.pdf`;
    const storagePath = `${sig.user_id}/${sig.contract_id}/${Date.now()}.pdf`;

    if (pdf_base64) {
      try {
        // Extract raw base64 from data URI
        const base64Data = pdf_base64.replace(/^data:application\/pdf;base64,/, "");
        const pdfBytes = decode(base64Data);

        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadErr) {
          console.error("Error uploading signed PDF:", uploadErr);
        } else {
          // Save document record with valid storage path
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
          }
        }
      } catch (e) {
        console.error("Error processing PDF upload:", e);
      }
    } else {
      // Fallback: save document record without actual file (legacy behavior)
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
      }
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
