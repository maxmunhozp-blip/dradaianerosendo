import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function testImapConnection(host: string, port: number, user: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = await Deno.connectTls({ hostname: host, port });
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Read greeting
    const greetBuf = new Uint8Array(4096);
    const greetN = await conn.read(greetBuf);
    if (!greetN) { conn.close(); return { success: false, error: "No greeting from server" }; }
    const greeting = decoder.decode(greetBuf.subarray(0, greetN));
    if (!greeting.includes("OK")) { conn.close(); return { success: false, error: "Server did not return OK greeting" }; }

    // LOGIN
    const loginCmd = `A001 LOGIN "${user.replace(/"/g, '\\"')}" "${password.replace(/"/g, '\\"')}"\r\n`;
    await conn.write(encoder.encode(loginCmd));

    let loginResponse = "";
    const loginBuf = new Uint8Array(4096);
    const readWithTimeout = async () => {
      const n = await conn.read(loginBuf);
      if (n) loginResponse += decoder.decode(loginBuf.subarray(0, n));
    };
    await readWithTimeout();

    // Possibly need to read more
    if (!loginResponse.includes("A001")) {
      await readWithTimeout();
    }

    // LOGOUT
    await conn.write(encoder.encode("A002 LOGOUT\r\n"));
    conn.close();

    if (loginResponse.includes("A001 OK")) {
      return { success: true };
    } else if (loginResponse.includes("A001 NO") || loginResponse.includes("A001 BAD")) {
      return { success: false, error: "Credenciais inválidas. Verifique e-mail e senha." };
    }

    return { success: false, error: "Resposta inesperada do servidor IMAP" };
  } catch (err) {
    return { success: false, error: `Erro de conexão: ${err instanceof Error ? err.message : String(err)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port, user, password } = await req.json();

    if (!host || !port || !user || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await testImapConnection(host, port, user, password);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
