import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_CONTEXT = `Você é especialista no sistema AdvocaciaIA — um SaaS jurídico para advogados brasileiros que inclui:
- Dashboard com métricas de casos, clientes e documentos
- CRM de clientes com casos, status stepper e timeline
- Gestão de documentos com upload, assinatura digital via ZapSign e geração de PDF
- Assistente LARA (IA jurídica) com comandos: /procuracao, /contrato, /peticao, /lei, /jurisprudencia, /prazos, /cobrar, /intimacoes
- Geração de petição inicial com modal de 3 etapas
- Portal do cliente com magic link para acesso e upload de documentos
- Agenda de audiências com lembretes via WhatsApp (Z-API)
- Monitoramento de intimações via Gmail/IMAP
- Assinatura digital de documentos via ZapSign
- Configurações de escritório, Z-API, ZapSign e templates de mensagem
- Gestão de usuários e permissões
- Templates de documentos
- Stack: React + Supabase + Lovable AI

Sua tarefa: dado o título, tipo e descrição de uma solicitação (bug, feature ou ajuste), 
reescreva a descrição de forma clara, técnica e acionável para um desenvolvedor.
Identifique o módulo afetado, o comportamento esperado vs. atual (se bug), 
e sugira critérios de aceite objetivos.
Responda APENAS com um JSON válido no formato:
{
  "interpretation": "Descrição melhorada e técnica da solicitação",
  "module": "Nome do módulo afetado",
  "priority": "baixa|normal|alta|critica",
  "acceptance_criteria": ["critério 1", "critério 2", "critério 3"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, description, type } = await req.json();

    if (!title || !description) {
      return new Response(
        JSON.stringify({ error: "title e description são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Tipo: ${type}\nTítulo: ${title}\nDescrição original: ${description}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_CONTEXT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const err = await response.text();
      console.error("AI gateway error:", response.status, err);
      return new Response(
        JSON.stringify({ error: "Erro na IA: " + err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      // Try to extract JSON from the content (may have markdown fences)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      parsed = {
        interpretation: content,
        module: "Geral",
        priority: "normal",
        acceptance_criteria: [],
      };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("interpret-request error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno: " + (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
