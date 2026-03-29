import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { account_id, to, subject, body, in_reply_to } = await req.json();

    if (!account_id || !to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: account_id, to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch account credentials
    const { data: account, error: accErr } = await supabase
      .from("email_accounts")
      .select("email, imap_user, imap_password, imap_host, smtp_host, smtp_port, provider")
      .eq("id", account_id)
      .single();

    if (accErr || !account) {
      return new Response(
        JSON.stringify({ error: "Conta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpHost = account.smtp_host || account.imap_host?.replace("imap.", "smtp.") || "smtp.hostinger.com";
    const smtpPort = account.smtp_port || 465;
    const username = account.imap_user || account.email;
    const password = account.imap_password;

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Credenciais SMTP não configuradas para esta conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connect and send via SMTP
    const client = new SmtpClient();

    await client.connectTLS({
      hostname: smtpHost,
      port: smtpPort,
      username,
      password,
    });

    const headers: Record<string, string> = {};
    if (in_reply_to) {
      headers["In-Reply-To"] = in_reply_to;
      headers["References"] = in_reply_to;
    }

    await client.send({
      from: account.email,
      to,
      subject,
      content: body,
      headers,
    });

    await client.close();

    console.log(`Email sent from ${account.email} to ${to}`);

    return new Response(
      JSON.stringify({ success: true, message: "E-mail enviado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao enviar e-mail" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
