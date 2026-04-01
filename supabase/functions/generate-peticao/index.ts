import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const buildSystemPrompt = (caseType: string) => `Você é LARA, assistente jurídica especializada em direito brasileiro.

Sua tarefa é redigir uma petição inicial completa e tecnicamente correta para uma ação de ${caseType}.

REGRAS ABSOLUTAS SOBRE VERIFICAÇÃO LEGAL:
- Quando dados de verificação LexML forem fornecidos na seção "VERIFICAÇÃO LEXML", use-os para fundamentar a petição.
- Para CADA lei citada na petição, se ela consta na verificação LexML, cite a URN oficial.
- Se uma lei citada NÃO foi verificada via LexML, marque-a com [VERIFICAR: lei não confirmada no LexML].
- Ao final da petição, adicione: "Fundamentação verificada via LexML em [data atual]."

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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }),
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
    if (clientData.rg) userPrompt += `- RG: ${clientData.rg}\n`;
    if (clientData.nationality) userPrompt += `- Nacionalidade: ${clientData.nationality}\n`;
    if (clientData.marital_status) userPrompt += `- Estado civil: ${clientData.marital_status}\n`;
    if (clientData.profession) userPrompt += `- Profissão: ${clientData.profession}\n`;
    if (clientData.address_street) {
      userPrompt += `- Endereço: ${clientData.address_street}, nº ${clientData.address_number || "S/N"} — ${clientData.address_city || ""}/${clientData.address_state || ""} CEP ${clientData.address_zip || ""}\n`;
    }
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

    // Fetch LexML verification for the case type
    let lexmlContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const lexmlQueries = [caseData.case_type];
      const lawMap: Record<string, string[]> = {
        "Divórcio": ["lei 10406 divórcio", "lei 13105 divórcio"],
        "Guarda": ["lei 10406 guarda", "lei 8069 guarda"],
        "Alimentos": ["lei 5478 alimentos", "lei 10406 alimentos"],
        "Inventário": ["lei 10406 inventário", "lei 11441 inventário"],
      };
      if (lawMap[caseData.case_type]) {
        lexmlQueries.push(...lawMap[caseData.case_type]);
      }

      const lexmlResults = await Promise.all(
        lexmlQueries.map(async (q: string) => {
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/lexml-search`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
              },
              body: JSON.stringify({ query: q }),
            });
            if (resp.ok) {
              const data = await resp.json();
              return data.results || [];
            }
          } catch { /* ignore */ }
          return [];
        })
      );

      const allResults = lexmlResults.flat();
      if (allResults.length > 0) {
        lexmlContext = "\n\nVERIFICAÇÃO LEXML (leis verificadas no portal oficial):\n";
        const seen = new Set<string>();
        for (const r of allResults) {
          if (seen.has(r.urn)) continue;
          seen.add(r.urn);
          lexmlContext += `- ${r.title} | URN: ${r.urn} | ${r.url}\n`;
        }
        lexmlContext += `\nData da verificação: ${new Date().toLocaleDateString("pt-BR")}\n`;
      }
    } catch (e) {
      console.error("LexML verification error:", e);
    }

    // Build Claude content blocks — supports native PDF and image reading
    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [
      { type: "text", text: userPrompt + (lexmlContext || "") },
    ];

    if (documentUrls && documentUrls.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const doc of documentUrls) {
        if (!doc.file_url) continue;
        try {
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

          const isPdf = doc.file_url.endsWith(".pdf");
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_url);

          if (isPdf) {
            // Claude natively reads PDFs
            contentBlocks.push({
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            } as any);
          } else if (isImage) {
            const mimeType = doc.file_url.match(/\.(jpg|jpeg)$/i)
              ? "image/jpeg"
              : doc.file_url.match(/\.png$/i)
              ? "image/png"
              : doc.file_url.match(/\.gif$/i)
              ? "image/gif"
              : "image/webp";

            contentBlocks.push({
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            } as any);
          } else {
            contentBlocks.push({
              type: "text",
              text: `[Documento "${doc.name}" — formato não suportado para leitura direta, ${Math.round(arrayBuffer.byteLength / 1024)}KB]`,
            });
          }
        } catch (e) {
          console.error(`Error fetching document ${doc.name}:`, e);
        }
      }
    }

    // Call Claude API with streaming
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: buildSystemPrompt(caseData.case_type),
      messages: [{ role: "user", content: contentBlocks }],
    });

    // Convert Claude stream to SSE format compatible with frontend
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if ("text" in delta) {
                const sseData = JSON.stringify({
                  choices: [{ delta: { content: delta.text } }],
                });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("Claude stream error:", e);
          const errorMsg = e instanceof Error ? e.message : "Erro no streaming";
          
          if (errorMsg.includes("rate_limit") || errorMsg.includes("429")) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." })}\n\n`));
          } else if (errorMsg.includes("insufficient") || errorMsg.includes("402")) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Créditos insuficientes." })}\n\n`));
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Erro ao gerar petição" })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("generate-peticao error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
