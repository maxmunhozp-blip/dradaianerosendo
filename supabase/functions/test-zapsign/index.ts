const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect common mistake: webhook secret pasted instead of API token
    if (token.length < 30) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Esse parece ser o token do Webhook, não o Token da API. Vá em Configurações → Integrações → ZapSign API → Access Token.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token by listing docs (GET endpoint that requires auth)
    const res = await fetch("https://api.zapsign.com.br/api/v1/docs/?page=1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      return new Response(
        JSON.stringify({ success: true, name: "Conexão validada com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errText = await res.text();
      console.error("ZapSign test error:", res.status, errText);

      if (res.status === 401 || res.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Token inválido ou expirado. Certifique-se de copiar o Token da API (não o do Webhook). Vá em: app.zapsign.com.br → Configurações → Integrações → ZapSign API.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `Erro ZapSign (${res.status}): ${errText}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error testing ZapSign:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao testar conexão" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
