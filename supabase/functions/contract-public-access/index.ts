import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
  const action = url.searchParams.get("action");

  try {
    // ACTION 1: Get contract token by external_reference (contract_id)
    if (action === "get-token") {
      const externalRef = url.searchParams.get("external_reference");
      if (!externalRef) {
        return new Response(JSON.stringify({ error: "external_reference é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sig, error } = await supabase
        .from("contract_signatures")
        .select("token, slug, client_name")
        .eq("contract_id", externalRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !sig) {
        return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-generate slug if missing
      let slug = sig.slug;
      if (!slug && sig.client_name) {
        slug = generateSlug(sig.client_name);
        await supabase
          .from("contract_signatures")
          .update({ slug })
          .eq("contract_id", externalRef);
      }

      return new Response(JSON.stringify({ token: sig.token, slug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION 2: Get full contract data by token or slug
    if (action === "get-contract") {
      const token = url.searchParams.get("token");
      const slug = url.searchParams.get("slug");

      if (!token && !slug) {
        return new Response(JSON.stringify({ error: "Token ou slug é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find signature by token or slug
      let query = supabase.from("contract_signatures").select("*");
      if (slug) {
        query = query.eq("slug", slug);
      } else {
        query = query.eq("token", token);
      }
      const { data: sig, error: sigErr } = await query.maybeSingle();

      if (sigErr || !sig) {
        return new Response(JSON.stringify({ error: "Acesso inválido" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!sig.contract_id) {
        return new Response(JSON.stringify({ error: "Contrato não vinculado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get contract
      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .select("id, event_type, event_date, event_date_end, event_time, guest_count, total_value, deposit_value, deposit_percent, remaining_value, payment_status, payment_choice, payment_method_selected, status, rental_type, mp_preference_id")
        .eq("id", sig.contract_id)
        .maybeSingle();

      if (cErr || !contract) {
        return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get payments
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, date, description")
        .eq("contract_id", sig.contract_id)
        .order("date", { ascending: true });

      // Get company settings for WhatsApp
      const { data: company } = await supabase
        .from("company_settings")
        .select("phone, company_name")
        .eq("user_id", sig.user_id)
        .maybeSingle();

      const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      // Get signed contract PDF URL from documents
      let pdfUrl: string | null = null;
      const { data: docs } = await supabase
        .from("documents")
        .select("file_name, name")
        .eq("contract_id", sig.contract_id)
        .order("created_at", { ascending: false });

      // Find signed contract: check type "signed_contract" or name containing "Assinado"
      const signedDoc = (docs || []).find(
        (d: any) => d.name?.includes("Assinado")
      ) || (docs || []).find(
        (d: any) => d.file_name?.endsWith(".pdf")
      );

      if (signedDoc && signedDoc.file_name) {
        const { data: signedUrl } = await supabase.storage
          .from("documents")
          .createSignedUrl(signedDoc.file_name, 3600);
        pdfUrl = signedUrl?.signedUrl || null;
      }

      // Auto-generate slug if missing
      let currentSlug = sig.slug;
      if (!currentSlug && sig.client_name) {
        currentSlug = generateSlug(sig.client_name);
        await supabase
          .from("contract_signatures")
          .update({ slug: currentSlug })
          .eq("id", sig.id);
      }

      return new Response(JSON.stringify({
        signature: {
          client_name: sig.client_name,
          client_phone: sig.client_phone,
          client_cpf: sig.client_cpf,
          event_date: sig.event_date,
          event_date_end: sig.event_date_end,
          event_type: sig.event_type,
          total_value: sig.total_value,
          deposit_percent: sig.deposit_percent,
          signed_at: sig.signed_at,
          status: sig.status,
          rental_type: sig.rental_type,
        },
        contract: {
          ...contract,
          total_paid: totalPaid,
        },
        payments: payments || [],
        company: {
          phone: company?.phone || "",
          name: company?.company_name || "Espaço Lamoniê",
        },
        slug: currentSlug,
        pdfUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("contract-public-access error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
