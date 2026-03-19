const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "PDF base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente especializado em extrair dados de contratos de locação de espaço para eventos (festas, casamentos, confraternizações).

Extraia os seguintes dados do contrato PDF fornecido. Retorne APENAS os dados encontrados. Se um campo não for encontrado, use null.

Os campos a extrair são:
- nome: Nome completo do cliente/contratante
- cpf: CPF do cliente (formato: 000.000.000-00)
- telefone: Telefone do cliente
- endereco: Endereço do cliente
- email: E-mail do cliente
- dataEvento: Data do evento (formato: YYYY-MM-DD)
- valorTotal: Valor total do contrato (número, sem R$)
- percentualSinal: Percentual do sinal/entrada (número)
- valorSinal: Valor do sinal/entrada (número, sem R$)
- valorRestante: Valor restante (número, sem R$)
- tipoEvento: Tipo do evento (Aniversário 15 anos, Aniversário Adulto, Aniversário Infantil, Casamento, Chá de bebê, Chá de fraldas, Chá de panela, Chá de revelação, Confraternização, Evento Corporativo, Recepção de casamento)
- convidados: Número de convidados`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extraia os dados deste contrato PDF. Retorne os dados usando a função extract_contract_data.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${pdfBase64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_contract_data",
                description: "Extrai dados estruturados do contrato",
                parameters: {
                  type: "object",
                  properties: {
                    nome: { type: "string", description: "Nome do cliente" },
                    cpf: { type: "string", description: "CPF do cliente" },
                    telefone: { type: "string", description: "Telefone" },
                    endereco: { type: "string", description: "Endereço" },
                    email: { type: "string", description: "E-mail" },
                    dataEvento: { type: "string", description: "Data do evento YYYY-MM-DD" },
                    valorTotal: { type: "number", description: "Valor total" },
                    percentualSinal: { type: "number", description: "Percentual do sinal" },
                    valorSinal: { type: "number", description: "Valor do sinal" },
                    valorRestante: { type: "number", description: "Valor restante" },
                    tipoEvento: { type: "string", description: "Tipo do evento" },
                    convidados: { type: "number", description: "Número de convidados" },
                  },
                  required: ["nome", "dataEvento", "valorTotal"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_contract_data" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos insuficientes para processamento de IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao processar PDF com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({ success: false, error: "IA não conseguiu extrair dados do PDF" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, data: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
