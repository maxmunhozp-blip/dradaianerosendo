import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLIENT_FIELDS = [
  "address_street", "address_number", "address_complement",
  "address_neighborhood", "address_city", "address_state", "address_zip",
  "nationality", "marital_status", "profession", "rg",
];

const CASE_FIELDS = [
  "children", "opposing_party_name", "opposing_party_cpf", "opposing_party_address",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, caseId, fields, case_fields } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: string[] = [];

    // Update client fields
    if (fields && typeof fields === "object") {
      const clientUpdate: Record<string, any> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (CLIENT_FIELDS.includes(key) && value !== null && value !== undefined && value !== "") {
          clientUpdate[key] = value;
        }
      }
      if (Object.keys(clientUpdate).length > 0) {
        const { error } = await supabase
          .from("clients")
          .update(clientUpdate)
          .eq("id", clientId);
        if (error) {
          console.error("Error updating client:", error);
          results.push(`Erro ao atualizar cliente: ${error.message}`);
        } else {
          results.push(`Cliente atualizado: ${Object.keys(clientUpdate).join(", ")}`);
        }
      }
    }

    // Update case fields
    if (caseId && case_fields && typeof case_fields === "object") {
      const caseUpdate: Record<string, any> = {};
      for (const [key, value] of Object.entries(case_fields)) {
        if (CASE_FIELDS.includes(key) && value !== null && value !== undefined) {
          caseUpdate[key] = value;
        }
      }
      if (Object.keys(caseUpdate).length > 0) {
        const { error } = await supabase
          .from("cases")
          .update(caseUpdate)
          .eq("id", caseId);
        if (error) {
          console.error("Error updating case:", error);
          results.push(`Erro ao atualizar caso: ${error.message}`);
        } else {
          results.push(`Caso atualizado: ${Object.keys(caseUpdate).join(", ")}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("save-client-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
