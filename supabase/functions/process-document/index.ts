import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DocOwner = "client" | "opposing" | "child" | "address" | "generic";

function detectDocOwner(fileName: string): DocOwner {
  const lower = fileName.toLowerCase();
  if (lower.includes("comprovante") || lower.includes("resid") || lower.includes("endereco")) return "address";
  if (lower.includes("genitora") || lower.includes("mae") || lower.includes("cliente")) return "client";
  if (lower.includes("genitor") || lower.includes("pai") || lower.includes("alimentante") || lower.includes("conjuge")) return "opposing";
  if ((lower.includes("certidao") || lower.includes("certidão")) && lower.includes("nascimento")) return "child";
  return "generic";
}

function detectDocType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if ((lower.includes("certidao") || lower.includes("certidão")) && lower.includes("nascimento")) return "certidao_nascimento";
  if ((lower.includes("certidao") || lower.includes("certidão")) && lower.includes("casamento")) return "certidao_casamento";
  if (lower.includes("rg") || lower.includes("cpf") || lower.includes("identidade")) return "rg_cpf";
  if (lower.includes("comprovante") && (lower.includes("resid") || lower.includes("endereco"))) return "comprovante_residencia";
  if (lower.includes("holerite") || lower.includes("contracheque") || lower.includes("salario")) return "holerite";
  return "outro";
}

function buildPrompt(owner: DocOwner, docType: string): string {
  switch (owner) {
    case "client":
      return `Este documento pertence À CLIENTE (mãe/genitora/parte autora). Extraia APENAS os dados DELA:
- client_nome (nome completo)
- client_cpf (apenas números)
- client_rg
- client_data_nascimento (YYYY-MM-DD)
- client_estado_civil
- client_profissao
- client_nacionalidade
- client_nome_mae
- client_nome_pai
Retorne APENAS um JSON com esses campos. Omita campos não encontrados.`;
    case "opposing":
      return `Este documento pertence À OUTRA PARTE (pai/genitor/cônjuge/alimentante/réu). Extraia APENAS os dados DELE(A):
- opposing_nome (nome completo)
- opposing_cpf (apenas números)
- opposing_rg
- opposing_data_nascimento (YYYY-MM-DD)
- opposing_endereco (endereço completo em uma linha)
Retorne APENAS um JSON com esses campos. Omita campos não encontrados.`;
    case "child":
      return `Esta é uma certidão de nascimento de uma CRIANÇA. Extraia:
- child_nome (nome completo da criança)
- child_data_nascimento (YYYY-MM-DD)
- child_nome_mae (nome da mãe)
- child_nome_pai (nome do pai)
- child_cpf (se houver)
Retorne APENAS um JSON com esses campos. Omita campos não encontrados.`;
    case "address":
      return `Este é um comprovante de residência. Extraia APENAS:
- address_titular (nome do titular da conta)
- address_cep
- address_logradouro (rua/avenida)
- address_numero
- address_complemento
- address_bairro
- address_cidade
- address_estado (sigla UF, ex: SP, RJ)
Retorne APENAS um JSON com esses campos. Omita campos não encontrados.`;
    default:
      if (docType === "rg_cpf") {
        return `Este é um documento de identificação (RG/CPF). Extraia:
- client_nome (nome completo)
- client_cpf (apenas números)
- client_rg
- client_data_nascimento (YYYY-MM-DD)
- client_nacionalidade
- client_nome_mae
- client_nome_pai
Retorne APENAS um JSON com esses campos. Omita campos não encontrados.`;
      }
      return `Analise este documento jurídico brasileiro. Identifique de QUEM são os dados e use o prefixo correto:
- Dados da cliente/autora: prefixo client_ (client_nome, client_cpf, client_rg)
- Dados da outra parte: prefixo opposing_ (opposing_nome, opposing_cpf)
- Dados de criança: prefixo child_ (child_nome, child_data_nascimento)
- Dados de endereço: prefixo address_ (address_cep, address_logradouro, etc)
Retorne APENAS um JSON. Omita campos não encontrados.`;
  }
}

// Normalize values for comparison (strip punctuation from CPF, RG, etc.)
function normalize(v: string | null | undefined): string {
  return (v || "").replace(/[.\-\/\s]/g, "").toLowerCase().trim();
}

// Classify each suggestion
type SuggestionConfidence = "high" | "medium" | "conflict";

interface ClassifiedSuggestion {
  field_path: string;
  suggested_value: string;
  current_value: string | null;
  confidence: SuggestionConfidence;
}

function classifySuggestions(
  extracted: Record<string, string>,
  clientData: Record<string, any>,
  caseData: Record<string, any>,
  docOwner: DocOwner,
): ClassifiedSuggestion[] {
  const results: ClassifiedSuggestion[] = [];

  const classify = (
    fieldPath: string,
    value: string | undefined,
    current: string | null | undefined,
    ownerClear: boolean,
  ) => {
    if (!value || !value.trim()) return;
    const trimmed = value.trim();
    const cur = current ?? null;
    const hasValue = cur && cur.trim() !== "" && cur !== "—";

    let confidence: SuggestionConfidence;
    if (hasValue && cur!.trim().toLowerCase() !== trimmed.toLowerCase()) {
      confidence = "conflict";
    } else if (hasValue && cur!.trim().toLowerCase() === trimmed.toLowerCase()) {
      // Same value already exists — treat as high, already correct
      confidence = "high";
    } else if (!hasValue && ownerClear) {
      confidence = "high";
    } else {
      confidence = "medium";
    }

    results.push({ field_path: fieldPath, suggested_value: trimmed, current_value: cur, confidence });
  };

  // CLIENT fields
  const clientMap: Record<string, string> = {
    client_nome: "name", client_cpf: "cpf", client_rg: "rg",
    client_data_nascimento: "birth_date", client_estado_civil: "marital_status",
    client_profissao: "profession", client_nacionalidade: "nationality",
  };
  for (const [key, dbField] of Object.entries(clientMap)) {
    if (extracted[key]) {
      const ownerClear = docOwner === "client" || (docOwner !== "opposing" && docOwner !== "generic");
      classify(`clients.${dbField}`, extracted[key], clientData[dbField], ownerClear);
    }
  }

  // OPPOSING fields
  const opposingMap: Record<string, string> = {
    opposing_nome: "opposing_party_name", opposing_cpf: "opposing_party_cpf",
    opposing_endereco: "opposing_party_address",
  };
  for (const [key, dbField] of Object.entries(opposingMap)) {
    if (extracted[key]) {
      const ownerClear = docOwner === "opposing";
      classify(`cases.${dbField}`, extracted[key], caseData[dbField], ownerClear);
    }
  }

  // CHILD
  if (extracted.child_nome && extracted.child_data_nascimento) {
    const childJson = JSON.stringify({
      name: extracted.child_nome,
      birth_date: extracted.child_data_nascimento,
      cpf: extracted.child_cpf || undefined,
    });
    const currentChildren = (caseData?.children as any[]) || [];
    const exists = currentChildren.some(
      (c: any) => (c.name || "").toLowerCase() === (extracted.child_nome || "").toLowerCase()
    );
    if (!exists) {
      const ownerClear = docOwner === "child";
      results.push({
        field_path: "cases.children_add",
        suggested_value: childJson,
        current_value: null,
        confidence: ownerClear ? "high" : "medium",
      });
    }
  }

  // ADDRESS
  const addressMap: Record<string, string> = {
    address_cep: "address_zip", address_logradouro: "address_street",
    address_numero: "address_number", address_complemento: "address_complement",
    address_bairro: "address_neighborhood", address_cidade: "address_city",
    address_estado: "address_state",
  };
  // Check if titular matches client
  let addressOwnerClear = docOwner === "address";
  if (extracted.address_titular && clientData?.name) {
    const titularFirst = (extracted.address_titular).toLowerCase().split(" ")[0];
    const clientFirst = (clientData.name).toLowerCase().split(" ")[0];
    addressOwnerClear = titularFirst === clientFirst ||
      (clientData.name).toLowerCase().includes(titularFirst) ||
      (extracted.address_titular).toLowerCase().includes(clientFirst);
  } else if (docOwner !== "address") {
    addressOwnerClear = false;
  }

  for (const [key, dbField] of Object.entries(addressMap)) {
    if (extracted[key]) {
      classify(`clients.${dbField}`, extracted[key], clientData[dbField], addressOwnerClear);
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, case_id, client_id, file_url, file_name } = await req.json();

    if (!document_id || !case_id || !client_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    await sb.from("documents").update({ extraction_status: "processing" }).eq("id", document_id);

    // Download file
    const storagePath = file_url?.split("/case-documents/")[1];
    if (!storagePath) throw new Error("Could not extract storage path from URL");

    const { data: fileData, error: downloadError } = await sb.storage
      .from("case-documents")
      .download(storagePath);
    if (downloadError || !fileData) throw new Error(`Download failed: ${downloadError?.message}`);

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);

    const lowerName = (file_name || "").toLowerCase();
    const isImage = lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png");
    const mimeType = isImage ? (lowerName.endsWith(".png") ? "image/png" : "image/jpeg") : "application/pdf";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const docOwner = detectDocOwner(file_name || "");
    const docType = detectDocType(file_name || "");
    const extractionPrompt = buildPrompt(docOwner, docType);

    const systemPrompt = `Você é um extrator de dados de documentos jurídicos brasileiros.
REGRAS CRÍTICAS:
1. Retorne APENAS um JSON válido, sem texto adicional, sem markdown.
2. NÃO invente dados. Se não encontrar um campo, omita-o.
3. Use EXATAMENTE os nomes de campos solicitados no prompt.
4. CPF deve conter apenas números (sem pontos ou traço).
5. Datas no formato YYYY-MM-DD.
6. Estado deve ser a sigla UF com 2 letras (SP, RJ, MG, etc).`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: extractionPrompt },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI Gateway error:", aiRes.status, errText);
      await sb.from("documents").update({ extraction_status: "failed" }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "AI extraction failed", details: errText }), {
        status: aiRes.status === 429 ? 429 : aiRes.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const textContent = aiData.choices?.[0]?.message?.content || "{}";

    let extracted: Record<string, string> = {};
    try {
      const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/) || textContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : textContent;
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse extraction result:", textContent);
      await sb.from("documents").update({
        extraction_status: "failed",
        extracted_data: { raw: textContent, parse_error: true },
      }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current data for comparison
    const { data: clientData } = await sb.from("clients").select("*").eq("id", client_id).single();
    const { data: caseData } = await sb.from("cases").select("*").eq("id", case_id).single();

    // Classify all suggestions
    const classified = classifySuggestions(extracted, clientData || {}, caseData || {}, docOwner);

    // Save ALL suggestions to DB with their confidence
    const suggestionsToInsert = classified.map((s) => ({
      document_id,
      case_id,
      client_id,
      field_path: s.field_path,
      suggested_value: s.suggested_value,
      current_value: s.current_value,
      status: s.confidence === "high" ? "accepted" : "pending",
    }));

    if (suggestionsToInsert.length > 0) {
      await sb.from("extraction_suggestions").insert(suggestionsToInsert);
    }

    // Auto-apply ONLY high_confidence
    let autoApplied = 0;
    const highConfidence = classified.filter((s) => s.confidence === "high");

    for (const s of highConfidence) {
      // Skip if same value already exists
      if (s.current_value && s.current_value.trim().toLowerCase() === s.suggested_value.toLowerCase()) {
        autoApplied++;
        continue;
      }

      const [table, field] = s.field_path.split(".");

      if (field === "children_add") {
        const childData = JSON.parse(s.suggested_value);
        const currentChildren = (caseData?.children as any[]) || [];
        await sb.from("cases").update({
          children: [...currentChildren, childData],
        }).eq("id", case_id);
        autoApplied++;
      } else if (table === "clients") {
        await sb.from("clients").update({ [field]: s.suggested_value }).eq("id", client_id);
        autoApplied++;
      } else if (table === "cases") {
        await sb.from("cases").update({ [field]: s.suggested_value } as any).eq("id", case_id);
        autoApplied++;
      }
    }

    // Update document status
    const fieldCount = Object.keys(extracted).length;
    const confidence = fieldCount >= 5 ? "high" : fieldCount >= 2 ? "medium" : "low";

    await sb.from("documents").update({
      extraction_status: "done",
      extracted_data: extracted,
      extraction_confidence: confidence,
      extracted_at: new Date().toISOString(),
    }).eq("id", document_id);

    const pendingReview = classified.filter((s) => s.confidence !== "high");

    // Return classified results for the frontend
    return new Response(
      JSON.stringify({
        success: true,
        doc_type: docType,
        doc_owner: docOwner,
        fields_found: fieldCount,
        suggestions_created: classified.length,
        auto_applied: autoApplied,
        pending_review: pendingReview.length,
        // Classified suggestions for frontend review panel
        classified: classified.map((s) => ({
          field_path: s.field_path,
          suggested_value: s.suggested_value,
          current_value: s.current_value,
          confidence: s.confidence,
        })),
        summary: `Extraí ${fieldCount} campos. ${autoApplied} aplicados automaticamente, ${pendingReview.length} aguardando revisão.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-document error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
