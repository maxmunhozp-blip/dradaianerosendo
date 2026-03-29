import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `Você é um parser de e-mails judiciais brasileiros. Extraia as informações do e-mail de intimação/notificação judicial abaixo.

Retorne APENAS um JSON válido com esta estrutura:
{
  "numero_processo": "string ou null",
  "tribunal": "string ou null",
  "tipo_movimentacao": "string ou null",
  "prazo_dias": "number ou null",
  "data_prazo": "YYYY-MM-DD ou null",
  "resumo": "string — 2-3 frases descrevendo a movimentação"
}

Exemplos de números de processo:
1234567-89.2024.8.26.0100 (TJSP)
0001234-56.2024.4.03.6100 (TRF3)

Exemplos de tribunais por domínio de e-mail:
- @tjsp.jus.br → TJSP
- @trf3.jus.br → TRF3
- @trf2.jus.br → TRF2
- @tst.jus.br → TST
- @stj.jus.br → STJ
- @pje.jus.br → PJe (verificar corpo para identificar tribunal)

Regras:
- Se o e-mail mencionar um prazo em dias, calcule a data_prazo a partir da data do e-mail + prazo_dias.
- Se não encontrar o número do processo, retorne null.
- tipo_movimentacao pode ser: "Intimação", "Despacho", "Sentença", "Decisão", "Mandado", "Citação", "Outro".
- O resumo deve ser objetivo e conter as informações mais relevantes da movimentação.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, body, from_email, date, gmail_message_id } = await req.json();

    if (!subject && !body) {
      return new Response(
        JSON.stringify({ error: "subject ou body são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for duplicate gmail_message_id
    if (gmail_message_id) {
      const { data: existing } = await supabase
        .from("intimacoes")
        .select("id")
        .eq("gmail_message_id", gmail_message_id)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ message: "Intimação já processada", id: existing.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const emailDate = date ? new Date(date) : new Date();

    // Call Claude API for extraction
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}\n\n---\nData do e-mail: ${emailDate.toISOString()}\nDe: ${from_email || "desconhecido"}\nAssunto: ${subject || "(sem assunto)"}\n\nCorpo:\n${body || "(vazio)"}`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || "";

    // Parse JSON from Claude response
    let extracted: any = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse Claude JSON:", e);
    }

    // Try to match process_number to existing cases
    let matchedCaseId: string | null = null;
    if (extracted.numero_processo) {
      const { data: matchedCase } = await supabase
        .from("cases")
        .select("id")
        .eq("cnj_number", extracted.numero_processo)
        .maybeSingle();
      if (matchedCase) {
        matchedCaseId = matchedCase.id;
      }
    }

    // Save to intimacoes table
    const { data: intimacao, error: insertError } = await supabase
      .from("intimacoes")
      .insert({
        case_id: matchedCaseId,
        raw_email_subject: subject || "",
        raw_email_body: body || "",
        raw_email_date: emailDate.toISOString(),
        from_email: from_email || null,
        process_number: extracted.numero_processo || null,
        tribunal: extracted.tribunal || null,
        movement_type: extracted.tipo_movimentacao || null,
        deadline_date: extracted.data_prazo || null,
        status: matchedCaseId ? "vinculado" : "novo",
        notes: null,
        gmail_message_id: gmail_message_id || null,
        ai_summary: extracted.resumo || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar intimação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If matched to a case and deadline found, create checklist item
    if (matchedCaseId && extracted.data_prazo) {
      await supabase.from("checklist_items").insert({
        case_id: matchedCaseId,
        label: `Prazo: ${extracted.tipo_movimentacao || "Intimação"} — ${extracted.data_prazo}`,
        done: false,
        required_by: "sistema",
      });
    }

    // If matched to a case and deadline found, create hearing
    if (matchedCaseId && extracted.data_prazo) {
      await supabase.from("hearings").insert({
        case_id: matchedCaseId,
        title: `Prazo — ${extracted.tipo_movimentacao || "Intimação"}`,
        date: new Date(extracted.data_prazo).toISOString(),
        location: extracted.tribunal || null,
        notes: extracted.resumo || null,
        status: "agendado",
      });
    }

    // Send WhatsApp notification via Z-API
    try {
      const { data: zapiSettings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["zapi_instance_id", "zapi_token", "office_phone"]);

      const settingsMap: Record<string, string> = {};
      for (const s of zapiSettings || []) settingsMap[s.key] = s.value;

      if (settingsMap.zapi_instance_id && settingsMap.zapi_token && settingsMap.office_phone) {
        const phone = settingsMap.office_phone.replace(/\D/g, "");
        const deadlineStr = extracted.data_prazo
          ? `\nPrazo: ${new Date(extracted.data_prazo).toLocaleDateString("pt-BR")}`
          : "";
        const msg = `Nova intimação recebida — Processo ${extracted.numero_processo || "não identificado"} — ${extracted.tipo_movimentacao || "Movimentação"}${deadlineStr}\nAcesse o LexAI para mais detalhes.`;

        await fetch(
          `https://api.z-api.io/instances/${settingsMap.zapi_instance_id}/token/${settingsMap.zapi_token}/send-text`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: `55${phone}`, message: msg }),
          }
        );
      }
    } catch (whatsappErr) {
      console.error("WhatsApp notification error:", whatsappErr);
      // Don't fail the whole request for WhatsApp errors
    }

    return new Response(
      JSON.stringify({
        success: true,
        intimacao,
        extracted,
        matched_case: !!matchedCaseId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-intimacao error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
