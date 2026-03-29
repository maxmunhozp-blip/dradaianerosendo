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

// Decode RFC 2047 encoded words (=?charset?encoding?text?=)
function decodeRfc2047(str: string): string {
  if (!str) return "";
  return str.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_match, charset: string, encoding: string, text: string) => {
      try {
        let bytes: Uint8Array;
        if (encoding.toUpperCase() === "B") {
          // Base64
          const bin = atob(text.replace(/\s/g, ""));
          bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        } else {
          // Quoted-Printable
          const decoded = text
            .replace(/_/g, " ")
            .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
        }
        return new TextDecoder(charset.toLowerCase()).decode(bytes);
      } catch {
        return text;
      }
    }
  );
}

// Decode base64 content
function decodeBase64(str: string): string {
  try {
    const cleaned = str.replace(/\s/g, "");
    const bin = atob(cleaned);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return str;
  }
}

// Decode quoted-printable content
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

// Parse MIME parts from raw email
function parseMimeParts(raw: string): { html: string | null; text: string } {
  // Find boundary
  const boundaryMatch = raw.match(/boundary="?([^"\s;]+)"?/i);
  
  if (!boundaryMatch) {
    // Not multipart — check Content-Transfer-Encoding of the whole message
    const cteMatch = raw.match(/^Content-Transfer-Encoding:\s*(.+)$/im);
    const cte = (cteMatch?.[1] || "").trim().toLowerCase();
    const ctMatch = raw.match(/^Content-Type:\s*([^;\s]+)/im);
    const ct = (ctMatch?.[1] || "").toLowerCase();
    
    // Split headers from body
    const bodyStart = raw.search(/\r?\n\r?\n/);
    if (bodyStart === -1) return { html: null, text: "" };
    let body = raw.substring(bodyStart).replace(/^\r?\n\r?\n/, "");
    
    if (cte.includes("base64")) {
      body = decodeBase64(body);
    } else if (cte.includes("quoted-printable")) {
      body = decodeQuotedPrintable(body);
    }
    
    if (ct.includes("text/html")) {
      return { html: body, text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
    }
    return { html: null, text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
  }

  const boundary = boundaryMatch[1];
  const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  
  let htmlContent: string | null = null;
  let textContent = "";

  for (const part of parts) {
    if (part.trim() === "--" || part.trim() === "") continue;
    
    const ctMatch = part.match(/Content-Type:\s*([^;\s]+)/i);
    const cteMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    const ct = (ctMatch?.[1] || "").toLowerCase();
    const cte = (cteMatch?.[1] || "").toLowerCase();
    
    // Check for nested multipart
    const nestedBoundary = part.match(/boundary="?([^"\s;]+)"?/i);
    if (nestedBoundary) {
      const nested = parseMimeParts(part);
      if (nested.html) htmlContent = nested.html;
      if (nested.text && !textContent) textContent = nested.text;
      continue;
    }
    
    // Get body of this part (after blank line)
    const bodyIdx = part.search(/\r?\n\r?\n/);
    if (bodyIdx === -1) continue;
    let body = part.substring(bodyIdx).replace(/^\r?\n\r?\n/, "");
    
    if (cte.includes("base64")) {
      body = decodeBase64(body);
    } else if (cte.includes("quoted-printable")) {
      body = decodeQuotedPrintable(body);
    }
    
    if (ct.includes("text/html")) {
      htmlContent = body;
    } else if (ct.includes("text/plain") && !textContent) {
      textContent = body;
    }
  }

  if (!textContent && htmlContent) {
    textContent = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return { html: htmlContent, text: textContent };
}

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
  "escavador",
];

async function imapCommand(
  conn: Deno.TlsConn,
  tag: string,
  command: string
): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  await conn.write(encoder.encode(`${tag} ${command}\r\n`));

  let response = "";
  const buf = new Uint8Array(65536);
  for (let i = 0; i < 50; i++) {
    const n = await conn.read(buf);
    if (!n) break;
    response += decoder.decode(buf.subarray(0, n));
    if (
      response.includes(`${tag} OK`) ||
      response.includes(`${tag} NO`) ||
      response.includes(`${tag} BAD`)
    ) {
      break;
    }
  }
  return response;
}

async function syncAccount(admin: any, account: ImapAccount): Promise<number> {
  const password = atob(account.imap_password);
  const conn = await Deno.connectTls({
    hostname: account.imap_host,
    port: account.imap_port,
  });

  // Read greeting
  const greetBuf = new Uint8Array(4096);
  await conn.read(greetBuf);

  // LOGIN
  const loginResp = await imapCommand(
    conn,
    "A001",
    `LOGIN "${account.imap_user}" "${password.replace(/"/g, '\\"')}"`
  );
  if (!loginResp.includes("A001 OK")) {
    conn.close();
    throw new Error("Login failed");
  }

  // SELECT INBOX
  await imapCommand(conn, "A002", "SELECT INBOX");

  // SEARCH for recent emails (last 7 days)
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const imapDate = `${since.getUTCDate()}-${months[since.getUTCMonth()]}-${since.getUTCFullYear()}`;
  const searchResp = await imapCommand(conn, "A003", `SEARCH SINCE ${imapDate}`);

  // Parse UIDs
  const searchLine = searchResp
    .split("\r\n")
    .find((l) => l.startsWith("* SEARCH"));
  const uids = searchLine
    ? searchLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean)
    : [];

  let newCount = 0;

  for (const uid of uids.slice(0, 20)) {
    // Check if already exists
    const { data: existing } = await admin
      .from("email_messages")
      .select("id")
      .eq("email_account_id", account.id)
      .eq("message_uid", uid)
      .maybeSingle();

    if (existing) continue;

    // FETCH entire message
    const fetchResp = await imapCommand(
      conn,
      `F${uid}`,
      `FETCH ${uid} BODY[]`
    );

    // Parse headers from raw message
    const fromMatch = fetchResp.match(/^From:\s*(.+)$/im);
    const subjectMatch = fetchResp.match(/^Subject:\s*(.+(?:\r?\n\s+.+)*)$/im);
    const dateMatch = fetchResp.match(/^Date:\s*(.+)$/im);

    const fromRaw = decodeRfc2047(fromMatch?.[1]?.trim() || "");
    const subject = decodeRfc2047(
      (subjectMatch?.[1] || "").replace(/\r?\n\s+/g, " ").trim()
    ) || "(sem assunto)";
    const dateStr = dateMatch?.[1]?.trim() || "";

    // Extract email and name from From header
    const emailExtract = fromRaw.match(/<([^>]+)>/);
    const fromEmail = emailExtract ? emailExtract[1] : fromRaw;
    const fromName = emailExtract
      ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/"/g, "")
      : "";

    const isJudicial = /\.jus\.br/i.test(fromEmail);

    // Parse MIME parts for proper HTML/text extraction
    const { html: bodyHtml, text: bodyText } = parseMimeParts(fetchResp);

    // Filter: only import legal-related emails
    const textToCheck =
      `${subject} ${fromEmail} ${fromName} ${bodyText}`.toLowerCase();
    const isLegal =
      isJudicial || legalKeywords.some((kw) => textToCheck.includes(kw));

    if (!isLegal) {
      console.log(`Skipping non-legal email: "${subject}" from ${fromEmail}`);
      continue;
    }

    // Save
    await admin.from("email_messages").insert({
      email_account_id: account.id,
      message_uid: uid,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      body_text: (bodyText || "").substring(0, 10000),
      body_html: bodyHtml ? bodyHtml.substring(0, 50000) : null,
      received_at: dateStr
        ? new Date(dateStr).toISOString()
        : new Date().toISOString(),
      is_read: false,
      is_judicial: isJudicial,
    });

    // If judicial, process as intimação
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
    } catch {
      /* no body */
    }

    let query = admin
      .from("email_accounts")
      .select("*")
      .in("provider", ["hostinger", "imap"]);

    if (accountId) query = query.eq("id", accountId);

    const { data: accounts, error: accErr } = await query;
    if (accErr) throw accErr;

    let totalNew = 0;

    for (const account of (accounts || []) as ImapAccount[]) {
      if (!account.imap_host || !account.imap_user || !account.imap_password)
        continue;

      try {
        const count = await syncAccount(admin, account);
        totalNew += count;

        await admin
          .from("email_accounts")
          .update({
            last_sync: new Date().toISOString(),
            status: "conectado",
          })
          .eq("id", account.id);
      } catch (err) {
        console.error(`Error syncing IMAP account ${account.id}:`, err);
        await admin
          .from("email_accounts")
          .update({ status: "erro" })
          .eq("id", account.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, new_emails: totalNew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-imap error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
