
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Public endpoint — no auth required (magic link)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token, data: formData } = await req.json();

    if (!token || !formData) {
      return new Response(JSON.stringify({ error: "token e data são obrigatórios" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Find the request
    const { data: request, error: findError } = await supabaseAdmin
      .from("data_requests")
      .select("*")
      .eq("token", token)
      .in("status", ["pending", "partial"])
      .gt("expires_at", new Date().toISOString())
      .single();

    if (findError || !request) {
      return new Response(JSON.stringify({ error: "Link expirado ou já utilizado" }), {
        status: 404, headers: corsHeaders,
      });
    }

    // Build client update from form data
    const clientUpdate: Record<string, unknown> = {};
    const caseUpdate: Record<string, unknown> = {};

    // Map form fields to client columns
    const clientFields: Record<string, string> = {
      address_street: "address_street",
      address_number: "address_number",
      address_complement: "address_complement",
      address_neighborhood: "address_neighborhood",
      address_city: "address_city",
      address_state: "address_state",
      address_zip: "address_zip",
      rg: "rg",
      marital_status: "marital_status",
      profession: "profession",
      nationality: "nationality",
    };

    for (const [formKey, dbKey] of Object.entries(clientFields)) {
      if (formData[formKey] !== undefined && formData[formKey] !== null && formData[formKey] !== "") {
        clientUpdate[dbKey] = formData[formKey];
      }
    }

    // Case fields
    if (formData.opposing_party_name) caseUpdate.opposing_party_name = formData.opposing_party_name;
    if (formData.opposing_party_cpf) caseUpdate.opposing_party_cpf = formData.opposing_party_cpf;
    if (formData.opposing_party_address) caseUpdate.opposing_party_address = formData.opposing_party_address;
    if (formData.children) caseUpdate.children = formData.children;

    // Track which fields were completed
    const fieldsCompleted: string[] = [];
    if (Object.keys(clientUpdate).length > 0) {
      if (clientUpdate.address_street) fieldsCompleted.push("address");
      if (clientUpdate.rg) fieldsCompleted.push("rg");
      if (clientUpdate.marital_status) fieldsCompleted.push("marital_status");
      if (clientUpdate.profession) fieldsCompleted.push("profession");
      if (clientUpdate.nationality) fieldsCompleted.push("nationality");
    }
    if (formData.children) fieldsCompleted.push("children");
    if (formData.opposing_party_name) fieldsCompleted.push("opposing_party");

    // Update client
    if (Object.keys(clientUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from("clients")
        .update(clientUpdate)
        .eq("id", request.client_id);
      if (error) throw error;
    }

    // Update case
    if (Object.keys(caseUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from("cases")
        .update(caseUpdate)
        .eq("id", request.case_id);
      if (error) throw error;
    }

    // Determine status
    const requestedFields = request.fields_requested || [];
    const allCompleted = requestedFields.every((f: string) => fieldsCompleted.includes(f));
    const newStatus = allCompleted ? "completed" : fieldsCompleted.length > 0 ? "partial" : "pending";

    // Mark request as completed/partial
    const { error: updateError } = await supabaseAdmin
      .from("data_requests")
      .update({
        status: newStatus,
        fields_completed: fieldsCompleted,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", request.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
