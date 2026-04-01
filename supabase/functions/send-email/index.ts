import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function smtpRead(conn: Deno.TlsConn): Promise<string> {
  const buf = new Uint8Array(4096);
  let result = "";
  for (let i = 0; i < 10; i++) {
    const n = await conn.read(buf);
    if (!n) break;
    result += decoder.decode(buf.subarray(0, n));
    // Check if we got a complete response (line ending with \r\n and starting with 3-digit code + space)
    const lines = result.split("\r\n").filter(Boolean);
    const lastLine = lines[lines.length - 1];
    if (lastLine && /^\d{3} /.test(lastLine)) break;
  }
  return result;
}

async function smtpWrite(conn: Deno.TlsConn, cmd: string): Promise<string> {
  await conn.write(encoder.encode(cmd + "\r\n"));
  return await smtpRead(conn);
}

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { account_id, to, cc, bcc, subject, body, in_reply_to } = await req.json();

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
    const password = account.imap_password || null;

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Credenciais SMTP não configuradas para esta conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connect via TLS (port 465 = implicit TLS)
    const conn = await Deno.connectTls({
      hostname: smtpHost,
      port: smtpPort,
    });

    // Read greeting
    await smtpRead(conn);

    // EHLO
    const ehloResp = await smtpWrite(conn, `EHLO lexai.local`);
    if (!ehloResp.includes("250")) {
      conn.close();
      throw new Error("EHLO failed: " + ehloResp);
    }

    // AUTH LOGIN
    let resp = await smtpWrite(conn, "AUTH LOGIN");
    if (!resp.includes("334")) {
      conn.close();
      throw new Error("AUTH LOGIN failed: " + resp);
    }

    resp = await smtpWrite(conn, encodeBase64(username));
    if (!resp.includes("334")) {
      conn.close();
      throw new Error("Username rejected: " + resp);
    }

    resp = await smtpWrite(conn, encodeBase64(password));
    if (!resp.includes("235")) {
      conn.close();
      throw new Error("Authentication failed: " + resp);
    }

    // MAIL FROM
    resp = await smtpWrite(conn, `MAIL FROM:<${account.email}>`);
    if (!resp.includes("250")) {
      conn.close();
      throw new Error("MAIL FROM failed: " + resp);
    }

    // RCPT TO (main recipient)
    resp = await smtpWrite(conn, `RCPT TO:<${to}>`);
    if (!resp.includes("250")) {
      conn.close();
      throw new Error("RCPT TO failed: " + resp);
    }

    // RCPT TO for CC
    if (cc) {
      resp = await smtpWrite(conn, `RCPT TO:<${cc}>`);
      if (!resp.includes("250")) {
        conn.close();
        throw new Error("RCPT TO (CC) failed: " + resp);
      }
    }

    // RCPT TO for BCC
    if (bcc) {
      resp = await smtpWrite(conn, `RCPT TO:<${bcc}>`);
      if (!resp.includes("250")) {
        conn.close();
        throw new Error("RCPT TO (BCC) failed: " + resp);
      }
    }

    // DATA
    resp = await smtpWrite(conn, "DATA");
    if (!resp.includes("354")) {
      conn.close();
      throw new Error("DATA failed: " + resp);
    }

    // Build email content
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
    let emailData = `From: ${account.email}\r\n`;
    emailData += `To: ${to}\r\n`;
    if (cc) emailData += `Cc: ${cc}\r\n`;
    emailData += `Subject: =?UTF-8?B?${encodeBase64(subject)}?=\r\n`;
    emailData += `MIME-Version: 1.0\r\n`;
    emailData += `Content-Type: text/plain; charset=UTF-8\r\n`;
    emailData += `Content-Transfer-Encoding: base64\r\n`;

    if (in_reply_to) {
      emailData += `In-Reply-To: ${in_reply_to}\r\n`;
      emailData += `References: ${in_reply_to}\r\n`;
    }

    emailData += `Date: ${new Date().toUTCString()}\r\n`;
    emailData += `\r\n`;
    emailData += encodeBase64(body) + "\r\n";
    emailData += ".\r\n";

    await conn.write(encoder.encode(emailData));
    resp = await smtpRead(conn);
    if (!resp.includes("250")) {
      conn.close();
      throw new Error("Send failed: " + resp);
    }

    // QUIT
    await smtpWrite(conn, "QUIT");
    conn.close();

    console.log(`Email sent from ${account.email} to ${to}`);

    // Store sent email in email_messages
    try {
      await supabase.from("email_messages").insert({
        email_account_id: account_id,
        message_uid: `sent_${crypto.randomUUID()}`,
        from_email: account.email,
        from_name: account.email,
        subject,
        body_text: body,
        body_html: null,
        received_at: new Date().toISOString(),
        is_read: true,
        is_judicial: false,
        category: "sent",
        direction: "outbound",
      });
    } catch (e) {
      console.error("Error storing sent email:", e);
    }

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
