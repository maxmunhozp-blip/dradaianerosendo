import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { document_id, signers } = await req.json();

    if (!document_id || !signers?.length) {
      return new Response(
        JSON.stringify({ error: "document_id e signers são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1 — Get ZapSign token and sandbox setting
    const [tokenResult, sandboxResult] = await Promise.all([
      supabase.from("settings").select("value").eq("key", "signature_api_token").single(),
      supabase.from("settings").select("value").eq("key", "signature_sandbox").single(),
    ]);

    const apiToken = tokenResult.data?.value;
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Configure o token ZapSign nas Configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const useSandbox = sandboxResult.data?.value !== "false";

    // Step 2 — Get document and download PDF
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("file_url, name")
      .eq("id", document_id)
      .single();

    if (docError || !doc?.file_url) {
      return new Response(
        JSON.stringify({ error: "Documento não encontrado ou sem arquivo." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract storage path from URL
    const marker = "/object/public/case-documents/";
    const idx = doc.file_url.indexOf(marker);
    const filePath = idx !== -1 ? doc.file_url.substring(idx + marker.length) : null;

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: "Caminho do arquivo inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from("case-documents")
      .download(filePath);

    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Erro ao baixar arquivo: " + (fileError?.message || "desconhecido") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Step 3 — Create document on ZapSign
    const zapSignBody = {
      name: doc.name,
      base64_pdf: base64,
      lang: "pt-BR",
      signers: signers.map((s: any) => ({
        name: s.name,
        email: s.email,
        cpf: s.cpf?.replace(/\D/g, "") || undefined,
        auth_mode: "assinaturaTela",
        send_automatic_email: true,
        lock_name: true,
      })),
    };

    const zapRes = await fetch("https://api.zapsign.com.br/api/v1/docs/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(zapSignBody),
    });

    if (!zapRes.ok) {
      const errText = await zapRes.text();
      console.error("ZapSign error:", errText);
      return new Response(
        JSON.stringify({ error: "Erro na API ZapSign: " + errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapData = await zapRes.json();

    // Step 4 — Save result
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        signature_status: "sent",
        signature_doc_token: zapData.token,
        signers: zapData.signers,
        signature_requested_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar resultado: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, signers: zapData.signers }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno: " + (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
