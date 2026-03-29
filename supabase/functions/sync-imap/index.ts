import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ImapAccount {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  gmail_message_id_cursor: string | null;
  platform: string;
}

async function imapCommand(
  conn: Deno.TlsConn,
  tag: string,
  command: string
): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  await conn.write(encoder.encode(`${tag} ${command}\r\n`));

  let response = "";
  const buf = new Uint8Array(16384);
  // Read until we get the tagged response
  for (let i = 0; i < 20; i++) {
    const n = await conn.read(buf);
    if (!n) break;
    response += decoder.decode(buf.subarray(0, n));
    if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
      break;
    }
  }
  return response;
}

async function syncAccount(admin: any, account: ImapAccount): Promise<number> {
  const password = atob(account.imap_password); // base64 decode
  const conn = await Deno.connectTls({ hostname: account.imap_host, port: account.imap_port });
  const decoder = new TextDecoder();

  // Read greeting
  const greetBuf = new Uint8Array(4096);
  await conn.read(greetBuf);

  // LOGIN
  const loginResp = await imapCommand(conn, "A001", `LOGIN "${account.imap_user}" "${password.replace(/"/g, '\\"')}"`);
  if (!loginResp.includes("A001 OK")) {
    conn.close();
    throw new Error("Login failed");
  }

  // SELECT INBOX
  await imapCommand(conn, "A002", "SELECT INBOX");

  // SEARCH for recent emails (last 7 days)
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const imapDate = `${since.getUTCDate()}-${months[since.getUTCMonth()]}-${since.getUTCFullYear()}`;
  const searchResp = await imapCommand(conn, "A003", `SEARCH SINCE ${imapDate}`);

  // Parse UIDs from SEARCH response
  const searchLine = searchResp.split("\r\n").find(l => l.startsWith("* SEARCH"));
  const uids = searchLine
    ? searchLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean)
    : [];

  let newCount = 0;

  for (const uid of uids.slice(0, 20)) { // Process max 20 at a time
    // Check if already in email_messages
    const { data: existing } = await admin
      .from("email_messages")
      .select("id")
      .eq("email_account_id", account.id)
      .eq("message_uid", uid)
      .maybeSingle();

    if (existing) continue;

    // FETCH the full message (headers + body)
    const fetchResp = await imapCommand(conn, `F${uid}`, `FETCH ${uid} (BODY[HEADER.FIELDS (FROM SUBJECT DATE CONTENT-TYPE)] BODY[])`);

    // Parse headers
    const fromMatch = fetchResp.match(/From:\s*(.+)/i);
    const subjectMatch = fetchResp.match(/Subject:\s*(.+)/i);
    const dateMatch = fetchResp.match(/Date:\s*(.+)/i);

    const fromRaw = fromMatch?.[1]?.trim() || "";
    const subject = subjectMatch?.[1]?.trim() || "(sem assunto)";
    const dateStr = dateMatch?.[1]?.trim() || "";

    // Extract email and name from From header
    const emailMatch = fromRaw.match(/<([^>]+)>/);
    const fromEmail = emailMatch ? emailMatch[1] : fromRaw;
    const fromName = emailMatch ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/"/g, "") : "";

    const isJudicial = /\.jus\.br/i.test(fromEmail);

    // Extract body - try to find HTML part
    const bodyParts = fetchResp.split(/\r\n\r\n/);
    const fullBody = bodyParts.length > 2 ? bodyParts.slice(2).join("\n\n") : "";
    
    // Try to extract HTML content
    let bodyHtml: string | null = null;
    let bodyText = "";
    
    const htmlMatch = fullBody.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) {
      bodyHtml = htmlMatch[0].substring(0, 50000);
      bodyText = htmlMatch[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 10000);
    } else {
      bodyText = fullBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 10000);
    }

    // Filter: only import emails related to law/legal/processes
    const textToCheck = `${subject} ${fromEmail} ${fromName} ${bodyText}`.toLowerCase();
    const legalKeywords = [
      "processo", "intimação", "intimacao", "citação", "citacao",
      "audiência", "audiencia", "sentença", "sentenca", "despacho",
      "mandado", "alvará", "alvara", "petição", "peticao",
      "recurso", "agravo", "apelação", "apelacao", "embargo",
      "jus.br", "pje", "esaj", "projudi", "tjsp", "tjrj", "tjmg",
      "tribunal", "vara", "juiz", "juízo", "juizo", "comarca",
      "réu", "reu", "autor", "advogad", "oab", "procuração", "procuracao",
      "diligência", "diligencia", "prazo", "contestação", "contestacao",
      "cnj", "distribuição", "distribuicao", "protocolo",
      "oficial de justiça", "oficial de justica",
      "carta precatória", "carta precatoria",
      "execução", "execucao", "penhora", "leilão", "leilao",
      "inventário", "inventario", "divórcio", "divorcio",
      "pensão", "pensao", "alimentos", "guarda", "tutela",
      "habeas corpus", "mandamus", "liminar", "tutela antecipada",
      "indenização", "indenizacao", "dano moral", "dano material",
      "trabalhista", "reclamação", "reclamacao", "trt", "tst",
      "previdenciário", "previdenciario", "inss", "benefício", "beneficio",
      "honorários", "honorarios", "custas", "emolumentos",
      "acórdão", "acordao", "jurisprudência", "jurisprudencia",
    ];
    const isLegal = isJudicial || legalKeywords.some(kw => textToCheck.includes(kw));

    if (!isLegal) {
      console.log(`Skipping non-legal email: "${subject}" from ${fromEmail}`);
      continue;
    }

    // Save to email_messages
    await admin.from("email_messages").insert({
      email_account_id: account.id,
      message_uid: uid,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      received_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      is_read: false,
      is_judicial: isJudicial,
    });

    // If judicial, call process-intimacao
    if (isJudicial) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/process-intimacao`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            subject,
            body: bodyText,
            from_email: fromEmail,
            date: dateStr,
            gmail_message_id: `imap_${account.id}_${uid}`,
          }),
        });
      } catch (e) {
        console.error("Error processing intimacao:", e);
      }
    }

    newCount++;
  }

  // LOGOUT
  await imapCommand(conn, "A099", "LOGOUT");
  conn.close();

  return newCount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let accountId: string | undefined;
    try {
      const body = await req.json();
      accountId = body.accountId || body.account_id;
    } catch { /* no body */ }

    // Fetch IMAP accounts
    let query = admin
      .from("email_accounts")
      .select("*")
      .in("provider", ["hostinger", "imap"]);

    if (accountId) query = query.eq("id", accountId);

    const { data: accounts, error: accErr } = await query;
    if (accErr) throw accErr;

    let totalNew = 0;

    for (const account of (accounts || []) as ImapAccount[]) {
      if (!account.imap_host || !account.imap_user || !account.imap_password) continue;

      try {
        const count = await syncAccount(admin, account);
        totalNew += count;

        await admin.from("email_accounts").update({
          last_sync: new Date().toISOString(),
          status: "conectado",
        }).eq("id", account.id);
      } catch (err) {
        console.error(`Error syncing IMAP account ${account.id}:`, err);
        await admin.from("email_accounts").update({ status: "erro" }).eq("id", account.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, new_emails: totalNew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-imap error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
