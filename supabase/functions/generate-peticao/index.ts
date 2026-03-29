import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const buildSystemPrompt = (caseType: string) => `Você é LARA, assistente jurídica especializada em direito brasileiro.

Sua tarefa é redigir uma petição inicial completa e tecnicamente correta para uma ação de ${caseType}.

REGRAS ABSOLUTAS:
- Cite APENAS leis que existem com número e ano corretos
- NUNCA invente números de acórdão ou julgados
- Se não tiver certeza de um julgado específico, descreva a tese jurídica sem inventar número
- Cite artigos no formato: "Art. X da Lei Y (Lei nº Z/AAAA)"
- Leis do Código Civil: sempre "(Lei 10.406/2002)"
- CPC: sempre "(Lei 13.105/2015)"
- ECA: sempre "(Lei 8.069/1990)"

LEIS SEGURAS POR TIPO DE CASO:

Para Divórcio:
- Arts. 1.571 a 1.582 do Código Civil (Lei 10.406/2002)
- EC 66/2010 (divórcio direto, sem prazo)
- Lei 11.441/2007 (divórcio extrajudicial)
- Art. 731 do CPC (Lei 13.105/2015) — divórcio consensual

Para Guarda:
- Arts. 1.583 a 1.590 do Código Civil (Lei 10.406/2002)
- Arts. 1.634 e 1.636 do Código Civil
- Arts. 78 a 92 do ECA (Lei 8.069/1990)
- Súmula 383 do STJ

Para Alimentos:
- Arts. 1.694 a 1.710 do Código Civil (Lei 10.406/2002)
- Lei de Alimentos (Lei 5.478/1968)
- Art. 529 do CPC (Lei 13.105/2015)
- Súmula 309 do STJ

Para Inventário:
- Arts. 1.784 a 2.027 do Código Civil (Lei 10.406/2002)
- Arts. 610 a 673 do CPC (Lei 13.105/2015)
- Lei 11.441/2007 (inventário extrajudicial)

FORMATO DA PETIÇÃO:

Use estrutura jurídica brasileira padrão:

EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA [VARA] VARA DE FAMÍLIA DA COMARCA DE [CIDADE] — ESTADO DE [ESTADO]

[espaço]

[QUALIFICAÇÃO DO AUTOR]

[nome], [nacionalidade], [estado civil], portador(a) do CPF nº [cpf], residente em [endereço], vem, respeitosamente, à presença de Vossa Excelência, por meio de sua advogada [procuradora], propor a presente:

AÇÃO DE [TIPO]

em face de [réu se houver], pelos fatos e fundamentos a seguir expostos:

I — DOS FATOS

[narrativa clara dos fatos extraída dos documentos e do contexto adicional fornecido]

II — DO DIREITO

[fundamentos jurídicos com citações corretas de leis e súmulas]

III — DOS PEDIDOS

Diante do exposto, requer a Vossa Excelência:

a) [pedido principal]
b) [pedidos acessórios]
c) A condenação em custas e honorários advocatícios

IV — DO VALOR DA CAUSA

Dá-se à causa o valor de R$ [valor], nos termos do art. 292 do CPC.

Nestes termos, pede deferimento.

[Cidade], [data por extenso].

Dra. Daiane Rosendo
OAB/[estado] nº [número]`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { caseData, clientData, documentUrls, additionalContext } = await req.json();

    if (!caseData || !clientData) {
      return new Response(
        JSON.stringify({ error: "Dados do caso e cliente são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user message with all context
    let userPrompt = `Redija uma petição inicial completa para a seguinte situação:\n\n`;
    userPrompt += `DADOS DO CASO:\n`;
    userPrompt += `- Tipo de ação: ${caseData.case_type}\n`;
    userPrompt += `- Status: ${caseData.status}\n`;
    if (caseData.court) userPrompt += `- Vara: ${caseData.court}\n`;
    if (caseData.cnj_number) userPrompt += `- CNJ: ${caseData.cnj_number}\n`;
    if (caseData.description) userPrompt += `- Descrição: ${caseData.description}\n`;

    userPrompt += `\nDADOS DO CLIENTE:\n`;
    userPrompt += `- Nome: ${clientData.name}\n`;
    if (clientData.cpf) userPrompt += `- CPF: ${clientData.cpf}\n`;
    if (clientData.email) userPrompt += `- E-mail: ${clientData.email}\n`;
    if (clientData.phone) userPrompt += `- Telefone: ${clientData.phone}\n`;

    if (additionalContext) {
      userPrompt += `\nINFORMAÇÕES ADICIONAIS DA ADVOGADA:\n${additionalContext}\n`;
    }

    if (documentUrls && documentUrls.length > 0) {
      userPrompt += `\nDOCUMENTOS ANEXADOS AO CASO (${documentUrls.length} documentos):\n`;
      for (const doc of documentUrls) {
        userPrompt += `- ${doc.name} [${doc.category}]\n`;
      }
    }

    userPrompt += `\nRedija a petição completa seguindo o formato especificado.`;

    // Fetch document contents from storage if URLs are provided
    const aiMessages: any[] = [];
    const contentParts: any[] = [{ type: "text", text: userPrompt }];

    if (documentUrls && documentUrls.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const doc of documentUrls) {
        if (!doc.file_url) continue;
        try {
          // Extract the file path from the URL
          const urlObj = new URL(doc.file_url);
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/case-documents\/(.+)/);
          if (!pathMatch) continue;

          const { data: fileData, error } = await supabase.storage
            .from("case-documents")
            .download(pathMatch[1]);

          if (error || !fileData) continue;

          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );

          const mimeType = doc.file_url.endsWith(".pdf")
            ? "application/pdf"
            : doc.file_url.match(/\.(jpg|jpeg)$/i)
            ? "image/jpeg"
            : doc.file_url.match(/\.png$/i)
            ? "image/png"
            : "application/octet-stream";

          if (mimeType.startsWith("image/")) {
            contentParts.push({
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            });
          } else {
            contentParts.push({
              type: "text",
              text: `[Conteúdo do documento "${doc.name}" — formato ${mimeType}, ${Math.round(arrayBuffer.byteLength / 1024)}KB]`,
            });
          }
        } catch (e) {
          console.error(`Error fetching document ${doc.name}:`, e);
        }
      }
    }

    aiMessages.push({
      role: "system",
      content: buildSystemPrompt(caseData.case_type),
    });
    aiMessages.push({
      role: "user",
      content: contentParts.length > 1 ? contentParts : userPrompt,
    });

    // Call AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar petição" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-peticao error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
