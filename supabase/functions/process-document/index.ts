import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Document type detection from file name
function detectDocType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("certidao") && lower.includes("nascimento")) return "certidao_nascimento";
  if (lower.includes("certidao") && lower.includes("casamento")) return "certidao_casamento";
  if (lower.includes("rg") || lower.includes("cpf") || lower.includes("identidade")) return "rg_cpf";
  if (lower.includes("comprovante") && (lower.includes("resid") || lower.includes("endereco"))) return "comprovante_residencia";
  if (lower.includes("holerite") || lower.includes("contracheque") || lower.includes("salario")) return "holerite";
  if (lower.includes("declaracao") && (lower.includes("ir") || lower.includes("renda") || lower.includes("imposto"))) return "declaracao_ir";
  if (lower.includes("iptu")) return "iptu";
  return "outro";
}

// Build extraction prompt based on document type
function buildPrompt(docType: string): string {
  const prompts: Record<string, string> = {
    certidao_nascimento:
      "Extraia deste documento: nome_completo da criança, data_nascimento (formato YYYY-MM-DD), nome_mae, nome_pai, cidade_nascimento, estado_nascimento, numero_matricula. Retorne como JSON.",
    certidao_casamento:
      "Extraia: nome_conjuge_1, nome_conjuge_2, cpf_conjuge_1, cpf_conjuge_2, data_casamento (YYYY-MM-DD), regime_bens, cartorio, cidade_casamento, numero_matricula. Retorne como JSON.",
    rg_cpf:
      "Extraia: nome_completo, cpf (apenas números), rg, data_nascimento (YYYY-MM-DD), nome_mae, nome_pai, naturalidade. Retorne como JSON.",
    comprovante_residencia:
      "Extraia: nome_titular, cep, logradouro, numero, complemento, bairro, cidade, estado. Retorne como JSON.",
    holerite:
      "Extraia: nome_funcionario, cpf (apenas números), empresa, cnpj_empresa, salario_bruto, salario_liquido, mes_referencia, ano_referencia. Retorne como JSON.",
    declaracao_ir:
      "Extraia: nome_contribuinte, cpf, ano_base, total_rendimentos, total_imposto_devido. Retorne como JSON.",
    outro:
      "Analise este documento jurídico brasileiro e extraia todos os dados pessoais relevantes que encontrar: nomes completos, CPF, RG, datas, endereços, valores monetários. Retorne como JSON com chaves descritivas.",
  };
  return prompts[docType] || prompts.outro;
}

// Map extracted fields to database field paths
function mapFieldsToSuggestions(
  docType: string,
  extracted: Record<string, string>,
  clientData: Record<string, any>,
  caseData: Record<string, any>
): Array<{ field_path: string; suggested_value: string; current_value: string | null }> {
  const suggestions: Array<{ field_path: string; suggested_value: string; current_value: string | null }> = [];

  const add = (fieldPath: string, value: string | undefined, current: string | null | undefined) => {
    if (value && value.trim()) {
      suggestions.push({
        field_path: fieldPath,
        suggested_value: value.trim(),
        current_value: current ?? null,
      });
    }
  };

  switch (docType) {
    case "rg_cpf":
      add("clients.name", extracted.nome_completo, clientData.name);
      add("clients.cpf", extracted.cpf, clientData.cpf);
      add("clients.rg", extracted.rg, clientData.rg);
      add("clients.nationality", extracted.naturalidade, clientData.nationality);
      break;

    case "comprovante_residencia":
      add("clients.address_zip", extracted.cep, clientData.address_zip);
      add("clients.address_street", extracted.logradouro, clientData.address_street);
      add("clients.address_number", extracted.numero, clientData.address_number);
      add("clients.address_complement", extracted.complemento, clientData.address_complement);
      add("clients.address_neighborhood", extracted.bairro, clientData.address_neighborhood);
      add("clients.address_city", extracted.cidade, clientData.address_city);
      add("clients.address_state", extracted.estado, clientData.address_state);
      break;

    case "certidao_casamento": {
      // Determine which spouse is the opposing party
      const clientName = (clientData.name || "").toLowerCase();
      const c1 = (extracted.nome_conjuge_1 || "").toLowerCase();
      const c2 = (extracted.nome_conjuge_2 || "").toLowerCase();
      const isC1Client = clientName.includes(c1.split(" ")[0]) || c1.includes(clientName.split(" ")[0]);

      if (isC1Client) {
        add("cases.opposing_party_name", extracted.nome_conjuge_2, caseData.opposing_party_name);
        add("cases.opposing_party_cpf", extracted.cpf_conjuge_2, caseData.opposing_party_cpf);
      } else {
        add("cases.opposing_party_name", extracted.nome_conjuge_1, caseData.opposing_party_name);
        add("cases.opposing_party_cpf", extracted.cpf_conjuge_1, caseData.opposing_party_cpf);
      }
      add("cases.description", extracted.regime_bens ? `Regime de bens: ${extracted.regime_bens}` : undefined, null);
      break;
    }

    case "certidao_nascimento":
      // Add child data to case children array
      if (extracted.nome_completo && extracted.data_nascimento) {
        const childJson = JSON.stringify({ name: extracted.nome_completo, birth_date: extracted.data_nascimento });
        add("cases.children_add", childJson, null);
      }
      break;

    case "holerite":
      add("clients.profession", extracted.empresa ? `Funcionário(a) - ${extracted.empresa}` : undefined, clientData.profession);
      break;

    default:
      // For unknown types, try to map common fields
      add("clients.name", extracted.nome_completo || extracted.nome, clientData.name);
      add("clients.cpf", extracted.cpf, clientData.cpf);
      add("clients.rg", extracted.rg, clientData.rg);
      break;
  }

  return suggestions;
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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Mark as processing
    await sb.from("documents").update({ extraction_status: "processing" }).eq("id", document_id);

    // Step 1: Download file from storage
    const storagePath = file_url?.split("/case-documents/")[1];
    if (!storagePath) {
      throw new Error("Could not extract storage path from URL");
    }

    const { data: fileData, error: downloadError } = await sb.storage
      .from("case-documents")
      .download(storagePath);
    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);

    // Step 2: Determine doc type and media type
    const docType = detectDocType(file_name || "");
    const lowerName = (file_name || "").toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isImage = lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png");

    let mimeType = "application/pdf";
    if (isImage) {
      mimeType = lowerName.endsWith(".png") ? "image/png" : "image/jpeg";
    }

    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Step 3: Call Lovable AI Gateway (OpenAI-compatible with Gemini vision)
    const systemPrompt =
      "Você é um extrator de dados de documentos jurídicos brasileiros. Analise o documento e retorne APENAS um JSON com os campos encontrados. Não invente dados. Se um campo não estiver claramente visível, omita-o. Retorne somente o JSON, sem texto adicional.";

    const userContent: any[] = [
      {
        type: "image_url",
        image_url: { url: dataUrl },
      },
      { type: "text", text: buildPrompt(docType) },
    ];

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
          { role: "user", content: userContent },
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

    // Parse JSON from response (handle markdown code blocks)
    let extracted: Record<string, string> = {};
    try {
      const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/) || textContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : textContent;
      extracted = JSON.parse(jsonStr);
    } catch (parseErr) {
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

    // Step 4: Get current client and case data for comparison
    const { data: clientData } = await sb.from("clients").select("*").eq("id", client_id).single();
    const { data: caseData } = await sb.from("cases").select("*").eq("id", case_id).single();

    const suggestions = mapFieldsToSuggestions(docType, extracted, clientData || {}, caseData || {});

    // Step 5: Create extraction suggestions
    const suggestionsToInsert = suggestions.map((s) => ({
      document_id,
      case_id,
      client_id,
      field_path: s.field_path,
      suggested_value: s.suggested_value,
      current_value: s.current_value,
    }));

    if (suggestionsToInsert.length > 0) {
      await sb.from("extraction_suggestions").insert(suggestionsToInsert);
    }

    // Step 5b: Auto-apply high confidence fields (empty fields)
    let autoApplied = 0;
    for (const s of suggestions) {
      if (!s.current_value || s.current_value === "" || s.current_value === "—") {
        const [table, field] = s.field_path.split(".");
        if (field === "children_add") {
          // Special handling: add child to children array
          const childData = JSON.parse(s.suggested_value);
          const currentChildren = (caseData?.children as any[]) || [];
          await sb.from("cases").update({
            children: [...currentChildren, childData],
          }).eq("id", case_id);
        } else if (table === "clients") {
          await sb.from("clients").update({ [field]: s.suggested_value }).eq("id", client_id);
        } else if (table === "cases") {
          await sb.from("cases").update({ [field]: s.suggested_value } as any).eq("id", case_id);
        }

        // Mark as accepted
        await sb.from("extraction_suggestions")
          .update({ status: "accepted" })
          .eq("document_id", document_id)
          .eq("field_path", s.field_path);

        autoApplied++;
      }
    }

    // Step 6: Update document
    const fieldCount = Object.keys(extracted).length;
    const confidence = fieldCount >= 5 ? "high" : fieldCount >= 2 ? "medium" : "low";

    await sb.from("documents").update({
      extraction_status: "done",
      extracted_data: extracted,
      extraction_confidence: confidence,
      extracted_at: new Date().toISOString(),
    }).eq("id", document_id);

    // Build summary
    const fieldNames = Object.keys(extracted).join(", ");
    const pendingCount = suggestions.length - autoApplied;

    return new Response(
      JSON.stringify({
        success: true,
        doc_type: docType,
        fields_found: fieldCount,
        suggestions_created: suggestions.length,
        auto_applied: autoApplied,
        pending_review: pendingCount,
        summary: `Extraí ${fieldCount} campos (${fieldNames}). ${autoApplied} aplicados automaticamente, ${pendingCount} aguardando revisão.`,
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
