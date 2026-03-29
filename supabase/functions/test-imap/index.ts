import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function testImapConnection(
  host: string,
  port: number,
  user: string,
  password: string
): Promise<{ success: boolean; error?: string; debug?: string }> {
  const steps: string[] = [];
  try {
    steps.push(`Connecting to ${host}:${port} via TLS...`);
    console.log(steps[steps.length - 1]);

    const conn = await Deno.connectTls({ hostname: host, port });
    steps.push("TLS connection established");
    console.log(steps[steps.length - 1]);

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Read greeting with timeout
    const greetBuf = new Uint8Array(4096);
    const greetN = await conn.read(greetBuf);
    if (!greetN) {
      conn.close();
      return { success: false, error: "Servidor não respondeu", debug: steps.join(" → ") };
    }
    const greeting = decoder.decode(greetBuf.subarray(0, greetN));
    steps.push(`Greeting: ${greeting.substring(0, 100)}`);
    console.log(steps[steps.length - 1]);

    if (!greeting.includes("OK")) {
      conn.close();
      return { success: false, error: "Servidor IMAP não retornou OK", debug: steps.join(" → ") };
    }

    // LOGIN
    steps.push("Sending LOGIN...");
    console.log(steps[steps.length - 1]);
    const loginCmd = `A001 LOGIN "${user.replace(/"/g, '\\"')}" "${password.replace(/"/g, '\\"')}"\r\n`;
    await conn.write(encoder.encode(loginCmd));

    let loginResponse = "";
    const loginBuf = new Uint8Array(4096);
    for (let i = 0; i < 5; i++) {
      const n = await conn.read(loginBuf);
      if (n) loginResponse += decoder.decode(loginBuf.subarray(0, n));
      if (loginResponse.includes("A001 OK") || loginResponse.includes("A001 NO") || loginResponse.includes("A001 BAD")) break;
    }

    steps.push(`Login response: ${loginResponse.substring(0, 100)}`);
    console.log(steps[steps.length - 1]);

    // LOGOUT
    await conn.write(encoder.encode("A002 LOGOUT\r\n"));
    conn.close();

    if (loginResponse.includes("A001 OK")) {
      return { success: true, debug: steps.join(" → ") };
    } else if (loginResponse.includes("A001 NO") || loginResponse.includes("A001 BAD")) {
      return { success: false, error: "Credenciais inválidas. Verifique e-mail e senha.", debug: steps.join(" → ") };
    }

    return { success: false, error: "Resposta inesperada do servidor", debug: steps.join(" → ") };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    steps.push(`ERROR: ${errMsg}`);
    console.error("IMAP test error:", errMsg);
    return { success: false, error: `Erro de conexão: ${errMsg}`, debug: steps.join(" → ") };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port, user, password } = await req.json();
    console.log(`Testing IMAP: host=${host}, port=${port}, user=${user}`);

    if (!host || !port || !user || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await testImapConnection(host, port, user, password);
    console.log("Test result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("test-imap handler error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
