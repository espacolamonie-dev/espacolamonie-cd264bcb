import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { pdf_base64, type } = body; // type: "expenses" | "entries"

    if (!pdf_base64) {
      return new Response(JSON.stringify({ error: "PDF obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = type === "entries"
      ? `Analise este extrato bancário em PDF e extraia APENAS os lançamentos de CRÉDITO (valores positivos/recebidos).
Para cada lançamento, retorne um JSON array com objetos contendo:
- "date": data no formato YYYY-MM-DD
- "description": descrição do lançamento
- "amount": valor positivo (número)

Ignore tarifas, taxas, IOF, juros, anuidades, saldo anterior e saldo final.
Ignore cabeçalhos e rodapés de página.
Normalize espaços duplicados e caracteres invisíveis nas descrições.
Retorne APENAS o JSON array, sem explicações. Se não encontrar créditos, retorne [].
Se o PDF não contiver texto legível (escaneado/imagem), retorne exatamente: {"error": "scanned"}`
      : `Analise este extrato bancário/cartão em PDF e extraia APENAS os lançamentos de DÉBITO (despesas/gastos).
Para cada lançamento, retorne um JSON array com objetos contendo:
- "date": data no formato YYYY-MM-DD (converta de dd/mm/aaaa se necessário)
- "description": descrição do lançamento (limpa, sem espaços extras)
- "amount": valor positivo (número, sem sinal negativo)

Ignore estornos, devoluções, créditos, saldo anterior e saldo final.
Ignore cabeçalhos e rodapés de página.
Normalize espaços duplicados e caracteres invisíveis nas descrições.
Retorne APENAS o JSON array, sem explicações. Se não encontrar débitos, retorne [].
Se o PDF não contiver texto legível (escaneado/imagem), retorne exatamente: {"error": "scanned"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdf_base64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Check for common provider errors
      if (response.status === 400 && errText.includes("no pages")) {
        return new Response(JSON.stringify({ error: "PDF inválido ou sem conteúdo legível. Envie CSV ou OFX." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar PDF. Tente CSV ou OFX." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", jsonStr);
      parsed = [];
    }

    // Handle scanned PDF response
    if (parsed && parsed.error === "scanned") {
      return new Response(JSON.stringify({ error: "PDF escaneado (imagem). Envie o extrato em CSV ou OFX." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transactions = Array.isArray(parsed) ? parsed : [];

    return new Response(JSON.stringify({ transactions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
