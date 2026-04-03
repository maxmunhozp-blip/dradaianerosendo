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
    console.log("[send-for-signature] Request:", JSON.stringify({ document_id, signerCount: signers?.length }));

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
      console.error("[send-for-signature] No API token configured");
      return new Response(
        JSON.stringify({ error: "Configure o token ZapSign nas Configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const useSandbox = sandboxResult.data?.value !== "false";
    console.log("[send-for-signature] Sandbox mode:", useSandbox);

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
    console.log("[send-for-signature] PDF downloaded, base64 length:", base64.length);

    // Step 3 — Create document on ZapSign
    const zapSignBody = {
      name: doc.name,
      base64_pdf: base64,
      sandbox: useSandbox,
      lang: "pt-BR",
      signers: signers.map((s: any) => ({
        name: s.name,
        email: s.email,
        cpf: s.cpf?.replace(/\D/g, "") || undefined,
        auth_mode: "assinaturaTela",
        send_automatic_email: !useSandbox,
        lock_name: true,
      })),
    };

    console.log("[send-for-signature] Calling ZapSign API...");

    let zapRes: Response;
    try {
      zapRes = await fetch("https://api.zapsign.com.br/api/v1/docs/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(zapSignBody),
        signal: AbortSignal.timeout(15000),
      });
    } catch (fetchErr: any) {
      const isTimeout = fetchErr?.name === "TimeoutError" || fetchErr?.name === "AbortError";
      console.error("[send-for-signature] ZapSign unreachable:", fetchErr?.message);
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? "ZapSign não respondeu a tempo. O serviço pode estar com instabilidade. Tente novamente em alguns minutos."
            : "Não foi possível conectar ao ZapSign. Verifique sua conexão ou tente novamente em instantes.",
          zapsign_status: "unreachable",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!zapRes.ok) {
      const errText = await zapRes.text();
      console.error("[send-for-signature] ZapSign error", zapRes.status, errText.substring(0, 300), "token_prefix:", apiToken.substring(0, 8));

      const friendlyMessages: Record<number, string> = {
        400: "Dados inválidos enviados ao ZapSign. Verifique o documento e os dados dos signatários.",
        401: "Token ZapSign inválido ou expirado. Atualize o token em Configurações → ZapSign.",
        402: "Sua conta ZapSign não possui o Plano de API ativo para modo produção. Ative o Sandbox em Configurações → ZapSign para testes, ou contrate o plano em app.zapsign.com.br.",
        403: "Sem permissão para usar a API ZapSign. Verifique se o token tem acesso à API.",
        429: "Limite de requisições ZapSign atingido. Aguarde alguns minutos e tente novamente.",
        500: "ZapSign está com instabilidade no momento. Tente novamente em alguns minutos.",
        502: "ZapSign está com instabilidade no momento (502). Tente novamente em alguns minutos.",
        503: "ZapSign está fora do ar no momento. Acompanhe em status.zapsign.com.br e tente mais tarde.",
      };

      const message = friendlyMessages[zapRes.status] || `Erro ZapSign (${zapRes.status}). Tente novamente ou contate o suporte.`;

      return new Response(
        JSON.stringify({ error: message, zapsign_status: zapRes.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapData = await zapRes.json();
    console.log("[send-for-signature] ZapSign response token:", zapData.token, "signers:", zapData.signers?.length);

    if (!zapData.token) {
      console.error("[send-for-signature] ZapSign returned no token:", JSON.stringify(zapData));
      return new Response(
        JSON.stringify({ error: "ZapSign não retornou token do documento. Verifique seu plano e créditos." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      console.error("[send-for-signature] DB update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar resultado: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-for-signature] Success! Document updated with token:", zapData.token);
    return new Response(
      JSON.stringify({ success: true, signers: zapData.signers }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-for-signature] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno: " + (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
