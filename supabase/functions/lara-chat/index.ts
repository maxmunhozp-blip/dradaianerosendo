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
- IMPORTANTE: Você TEM acesso aos dados em tempo real do escritório. Quando perguntarem sobre clientes, casos, documentos pendentes, etc., use os dados fornecidos na seção "CONTEXTO ATUAL DO ESCRITÓRIO" abaixo. Nunca diga que não tem acesso aos dados — os dados estão disponíveis para você.

## Comandos especiais
Quando a mensagem começar com um comando:
- /procuracao → Gere um modelo de procuração ad judicia para o caso em questão
- /contrato → Gere um modelo de contrato de honorários advocatícios
- /peticao → Inicie a redação de uma petição inicial com base no tipo do caso
- /checklist → Gere uma lista completa de documentos necessários para o tipo de caso
- /analise → Analise o documento ou informação fornecida e dê um parecer técnico

## Envio de WhatsApp — Cobrança de documentos pendentes
Quando a advogada pedir para cobrar documentos pendentes, enviar lembretes por WhatsApp, ou usar o comando /cobrar:

1. Identifique todos os clientes que possuem documentos pendentes (status "solicitado") e/ou itens de checklist pendentes (done = false) usando os dados do CONTEXTO ATUAL DO ESCRITÓRIO.
2. Para CADA cliente com pendências, gere uma mensagem personalizada no seguinte formato:

---
**Mensagem para [Nome do cliente]** (Tel: [telefone])

Olá [primeiro nome]! Tudo bem?

Sou a Dra. Daiane Rosendo. Passando para lembrar que ainda precisamos dos seguintes documentos para dar andamento ao seu processo:

• [documento 1]
• [documento 2]
• ...

Assim que puder, envie pelo portal ou responda esta mensagem. Qualquer dúvida estou à disposição!
---

3. Após listar TODAS as mensagens, adicione o seguinte bloco de ação no final da sua resposta (OBRIGATÓRIO — este bloco é processado pelo sistema para habilitar o botão de envio):

\`\`\`whatsapp-action
[
  {"phone": "[telefone do cliente 1]", "message": "[mensagem completa]", "name": "[nome do cliente 1]"},
  {"phone": "[telefone do cliente 2]", "message": "[mensagem completa]", "name": "[nome do cliente 2]"}
]
\`\`\`

4. Antes do bloco de ação, escreva: "Deseja enviar para X clientes? Clique no botão abaixo para confirmar o envio."

REGRAS IMPORTANTES para WhatsApp:
- Só inclua clientes que tenham telefone cadastrado. Se um cliente não tem telefone, mencione isso e pule.
- Use os dados REAIS do contexto. Nunca invente nomes, telefones ou documentos.
- Formate o telefone apenas com números (ex: 5511999999999).
- Se não houver clientes com pendências, informe que está tudo em dia.
- Se a advogada pedir para cobrar um cliente específico, gere apenas a mensagem daquele cliente.
- O template padrão pode ser personalizado se a advogada pedir. Verifique se há um template customizado nos dados de configuração.`;

async function fetchSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "template_doc_reminder",
      "template_welcome",
      "template_signing",
      "office_name",
      "office_oab",
      "office_phone",
      "office_email",
    ]);
  const map: Record<string, string> = {};
  for (const row of data || []) map[row.key] = row.value;
  return map;
}

async function fetchOfficeContext(supabase: any): Promise<string> {
  // 1. All active clients with their cases
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, cpf, email, phone, status")
    .eq("status", "ativo");

  if (!clients || clients.length === 0) {
    return `
---
CONTEXTO ATUAL DO ESCRITÓRIO (dados em tempo real):
Nenhum cliente ativo encontrado no sistema.
---`;
  }

  // 2. All cases for active clients
  const clientIds = clients.map((c: any) => c.id);
  const { data: cases } = await supabase
    .from("cases")
    .select("id, case_type, status, client_id, cnj_number, court, description")
    .in("client_id", clientIds);

  const caseIds = (cases || []).map((c: any) => c.id);

  // 3. Pending checklist items and pending documents in parallel
  const [checklistResult, docsResult] = await Promise.all([
    caseIds.length > 0
      ? supabase
          .from("checklist_items")
          .select("id, label, case_id, required_by")
          .in("case_id", caseIds)
          .eq("done", false)
      : { data: [] },
    caseIds.length > 0
      ? supabase
          .from("documents")
          .select("id, name, category, case_id")
          .in("case_id", caseIds)
          .eq("status", "solicitado")
      : { data: [] },
  ]);

  const pendingChecklist = checklistResult.data || [];
  const pendingDocs = docsResult.data || [];

  // Group by case
  const checklistByCase: Record<string, any[]> = {};
  for (const item of pendingChecklist) {
    if (!checklistByCase[item.case_id]) checklistByCase[item.case_id] = [];
    checklistByCase[item.case_id].push(item);
  }

  const docsByCase: Record<string, any[]> = {};
  for (const doc of pendingDocs) {
    if (!docsByCase[doc.case_id]) docsByCase[doc.case_id] = [];
    docsByCase[doc.case_id].push(doc);
  }

  // Build client → cases map
  const casesByClient: Record<string, any[]> = {};
  for (const c of cases || []) {
    if (!casesByClient[c.client_id]) casesByClient[c.client_id] = [];
    casesByClient[c.client_id].push(c);
  }

  // Build the context string
  let clientsWithPending = "";
  for (const client of clients) {
    const clientCases = casesByClient[client.id] || [];
    const hasPending = clientCases.some(
      (c: any) => (checklistByCase[c.id]?.length || 0) > 0 || (docsByCase[c.id]?.length || 0) > 0
    );

    if (hasPending) {
      clientsWithPending += `\n- **${client.name}** (CPF: ${client.cpf || "N/A"}, E-mail: ${client.email || "N/A"}, Tel: ${client.phone || "N/A"})`;
      for (const cs of clientCases) {
        const pendingCL = checklistByCase[cs.id] || [];
        const pendingD = docsByCase[cs.id] || [];
        if (pendingCL.length > 0 || pendingD.length > 0) {
          clientsWithPending += `\n  Caso: ${cs.case_type} (Status: ${cs.status})`;
          if (pendingD.length > 0) {
            clientsWithPending += `\n  Documentos pendentes (solicitados):`;
            for (const d of pendingD) {
              clientsWithPending += `\n    - ${d.name} [${d.category}]`;
            }
          }
          if (pendingCL.length > 0) {
            clientsWithPending += `\n  Checklist pendente:`;
            for (const cl of pendingCL) {
              clientsWithPending += `\n    - ${cl.label}${cl.required_by ? ` (responsável: ${cl.required_by})` : ""}`;
            }
          }
        }
      }
    }
  }

  // Status counts
  const statusCounts: Record<string, number> = {};
  for (const c of cases || []) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  }
  const statusList = Object.entries(statusCounts)
    .map(([s, n]) => `- ${s}: ${n} caso(s)`)
    .join("\n");

  // All clients summary
  let allClientsSummary = "";
  for (const client of clients) {
    const clientCases = casesByClient[client.id] || [];
    allClientsSummary += `\n- **${client.name}**: ${clientCases.length > 0 ? clientCases.map((c: any) => `${c.case_type} (${c.status})`).join(", ") : "sem casos"}`;
  }

  return `
---
CONTEXTO ATUAL DO ESCRITÓRIO (dados em tempo real):

Clientes ativos (${clients.length}):
${allClientsSummary}

Clientes com documentos/checklist pendentes:
${clientsWithPending || "Nenhum cliente com pendências."}

Casos por status:
${statusList || "Nenhum caso cadastrado."}

Total de documentos pendentes (solicitados): ${pendingDocs.length}
Total de itens de checklist pendentes: ${pendingChecklist.length}
---`;
}

async function fetchCaseContext(supabase: any, caseId: string): Promise<string> {
  const { data: caseData } = await supabase
    .from("cases")
    .select("*, clients(name, cpf, email, phone, status)")
    .eq("id", caseId)
    .single();

  if (!caseData) return "";

  const client = (caseData as any).clients;

  const [docsResult, checklistResult] = await Promise.all([
    supabase
      .from("documents")
      .select("name, category, status, uploaded_by, created_at")
      .eq("case_id", caseId),
    supabase
      .from("checklist_items")
      .select("label, done, required_by")
      .eq("case_id", caseId),
  ]);

  const docs = docsResult.data || [];
  const checklist = checklistResult.data || [];

  return `
## Contexto do caso selecionado (dados completos)
- **Cliente**: ${client?.name || "N/A"} (CPF: ${client?.cpf || "N/A"})
- **Contato**: ${client?.email || "N/A"} | ${client?.phone || "N/A"}
- **Status do cliente**: ${client?.status || "N/A"}
- **Tipo de ação**: ${caseData.case_type}
- **Status do caso**: ${caseData.status}
- **CNJ**: ${caseData.cnj_number || "Não atribuído"}
- **Vara**: ${caseData.court || "Não definida"}
- **Descrição**: ${caseData.description || "Sem descrição"}

### Todos os documentos do caso (${docs.length})
${docs.length > 0
    ? docs.map((d: any) => `- ${d.name} [${d.category}] — Status: ${d.status} (enviado por: ${d.uploaded_by})`).join("\n")
    : "Nenhum documento cadastrado."}

### Checklist completo (${checklist.length} itens)
${checklist.length > 0
    ? checklist.map((c: any) => `- [${c.done ? "x" : " "}] ${c.label}${c.required_by ? ` (responsável: ${c.required_by})` : ""}`).join("\n")
    : "Nenhum item no checklist."}`;
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Always fetch live office context + optional case context in parallel
    const [officeContext, caseContext] = await Promise.all([
      fetchOfficeContext(supabase),
      caseId ? fetchCaseContext(supabase, caseId) : Promise.resolve(""),
    ]);

    const fullSystemPrompt = SYSTEM_PROMPT + "\n\n" + officeContext + (caseContext ? "\n\n" + caseContext : "");

    // Build messages for the AI API
    const aiMessages: any[] = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Process messages, handling attachments
    for (const msg of messages) {
      if (msg.role === "user" && msg.attachments && msg.attachments.length > 0) {
        const content: any[] = [{ type: "text", text: msg.content }];
        for (const att of msg.attachments) {
          if (att.type === "image") {
            content.push({
              type: "image_url",
              image_url: { url: att.data },
            });
          } else if (att.type === "pdf") {
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

    // Intercept the stream to save the full assistant response to DB
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullAssistantContent = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
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
