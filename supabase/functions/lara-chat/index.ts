import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é LARA — Legal AI Research Assistant — uma assistente jurídica especializada em Direito de Família brasileiro.

## Identidade
- Você é uma assistente de inteligência artificial integrada ao sistema LexAI, utilizada por uma advogada especialista em Direito de Família.
- Seu tom é profissional, objetivo e empático quando necessário.
- Nunca use emojis. Use linguagem formal mas acessível.
- Responda sempre em português do Brasil.

## Capacidades
Você pode ajudar com:
1. **Redação jurídica**: petições iniciais, contestações, réplicas, acordos, procurações, contratos de honorários
2. **Análise de documentos**: analisar contratos, decisões judiciais, laudos, certidões
3. **Checklists processuais**: gerar listas de documentos necessários por tipo de ação
4. **Pesquisa jurídica**: fundamentação legal, jurisprudência relevante, doutrina aplicável
5. **Cálculos**: pensão alimentícia (binômio necessidade/possibilidade), partilha de bens, custas processuais
6. **Orientação processual**: prazos, competência, procedimentos especiais

## Áreas de Família
- Divórcio (consensual e litigioso, judicial e extrajudicial)
- Guarda (compartilhada, unilateral, alternada)
- Alimentos (fixação, revisão, execução, exoneração)
- Inventário e partilha (judicial e extrajudicial)
- Reconhecimento e dissolução de união estável
- Alienação parental
- Regulamentação de visitas
- Interdição e curatela
- Adoção

## Legislação de referência
- Código Civil (Lei 10.406/2002) — Livro IV, Direito de Família
- CPC (Lei 13.105/2015) — procedimentos especiais de família
- ECA (Lei 8.069/1990) — guarda, adoção, alimentos
- Lei do Divórcio (EC 66/2010)
- Lei de Alimentos (Lei 5.478/1968)
- Lei da Alienação Parental (Lei 12.318/2010)
- Lei do Inventário Extrajudicial (Lei 11.441/2007)

## Regras
- Sempre cite artigos de lei quando fundamentar uma resposta.
- Quando redigir peças, use o formato processual correto com qualificação das partes, dos fatos, do direito e dos pedidos.
- Se o contexto do caso estiver disponível, use os dados reais do caso (nome do cliente, tipo de ação, documentos já recebidos).
- Se não souber algo com certeza, diga "não tenho certeza" em vez de inventar.
- Nunca forneça conselho que substitua a decisão da advogada — você é uma ferramenta de apoio.

## Comandos especiais
Quando a mensagem começar com um comando:
- /procuracao → Gere um modelo de procuração ad judicia para o caso em questão
- /contrato → Gere um modelo de contrato de honorários advocatícios
- /peticao → Inicie a redação de uma petição inicial com base no tipo do caso
- /checklist → Gere uma lista completa de documentos necessários para o tipo de caso
- /analise → Analise o documento ou informação fornecida e dê um parecer técnico`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, caseId, attachments } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build case context if caseId provided
    let caseContext = "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (caseId) {
      // Load case with client info
      const { data: caseData } = await supabase
        .from("cases")
        .select("*, clients(name, cpf, email, phone, status)")
        .eq("id", caseId)
        .single();

      if (caseData) {
        const client = (caseData as any).clients;
        
        // Load documents
        const { data: docs } = await supabase
          .from("documents")
          .select("name, category, status, uploaded_by")
          .eq("case_id", caseId);

        // Load checklist
        const { data: checklist } = await supabase
          .from("checklist_items")
          .select("label, done, required_by")
          .eq("case_id", caseId);

        caseContext = `
## Contexto do caso atual
- **Cliente**: ${client?.name || "N/A"} (CPF: ${client?.cpf || "N/A"})
- **Contato**: ${client?.email || "N/A"} | ${client?.phone || "N/A"}
- **Tipo de ação**: ${caseData.case_type}
- **Status do caso**: ${caseData.status}
- **CNJ**: ${caseData.cnj_number || "Não atribuído"}
- **Vara**: ${caseData.court || "Não definida"}
- **Descrição**: ${caseData.description || "Sem descrição"}

### Documentos do caso
${docs && docs.length > 0
  ? docs.map((d: any) => `- ${d.name} [${d.category}] — Status: ${d.status} (enviado por: ${d.uploaded_by})`).join("\n")
  : "Nenhum documento cadastrado."}

### Checklist
${checklist && checklist.length > 0
  ? checklist.map((c: any) => `- [${c.done ? "x" : " "}] ${c.label}${c.required_by ? ` (responsável: ${c.required_by})` : ""}`).join("\n")
  : "Nenhum item no checklist."}`;
      }
    }

    const fullSystemPrompt = SYSTEM_PROMPT + (caseContext ? "\n\n" + caseContext : "");

    // Build messages for the AI API
    const aiMessages: any[] = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Process messages, handling attachments
    for (const msg of messages) {
      if (msg.role === "user" && msg.attachments && msg.attachments.length > 0) {
        // Multi-modal message with files
        const content: any[] = [{ type: "text", text: msg.content }];
        for (const att of msg.attachments) {
          if (att.type === "image") {
            content.push({
              type: "image_url",
              image_url: { url: att.data },
            });
          } else if (att.type === "pdf") {
            // Send PDF content as text context
            content.push({
              type: "text",
              text: `[Documento anexado: ${att.name}]\n${att.extractedText || "(conteúdo não extraído)"}`,
            });
          }
        }
        aiMessages.push({ role: "user", content });
      } else {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Save the user message to DB
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === "user" && caseId) {
      await supabase.from("messages").insert({
        case_id: caseId,
        role: "user",
        content: lastUserMsg.content,
        attachments: lastUserMsg.attachments || null,
      });
    }

    // Call Lovable AI Gateway with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com a IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // We need to intercept the stream to save the full assistant response to DB
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullAssistantContent = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          // Save complete assistant message to DB
          if (caseId && fullAssistantContent) {
            await supabase.from("messages").insert({
              case_id: caseId,
              role: "assistant",
              content: fullAssistantContent,
            });
          }
          controller.close();
          return;
        }

        // Parse chunks to accumulate assistant content
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullAssistantContent += content;
          } catch {
            // partial chunk, ignore
          }
        }

        controller.enqueue(value);
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("lara-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
