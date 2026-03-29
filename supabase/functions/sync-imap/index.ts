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
// Simple body extractor - avoids recursive MIME parsing issues
function extractEmailBody(raw: string): { html: string | null; text: string } {
  try {
    // Try to find text/plain or text/html parts
    let htmlContent: string | null = null;
    let textContent = "";

    // Find boundary
    const boundaryMatch = raw.match(/boundary="?([^"\s;]+)"?/i);

    if (!boundaryMatch) {
      // Single-part message
      const cteMatch = raw.match(/^Content-Transfer-Encoding:\s*(.+)$/im);
      const cte = (cteMatch?.[1] || "").trim().toLowerCase();
      const ctMatch = raw.match(/^Content-Type:\s*([^;\s]+)/im);
      const ct = (ctMatch?.[1] || "").toLowerCase();

      const bodyStart = raw.search(/\r?\n\r?\n/);
      if (bodyStart === -1) return { html: null, text: "" };
      let body = raw.substring(bodyStart).replace(/^\r?\n\r?\n/, "");

      if (cte.includes("base64")) body = decodeBase64(body);
      else if (cte.includes("quoted-printable")) body = decodeQuotedPrintable(body);

      if (ct.includes("text/html")) {
        return { html: body, text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
      }
      return { html: null, text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
    }

    // Multipart - split by boundary (non-recursive, flat scan)
    const escapedBoundary = boundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = raw.split(new RegExp(`--${escapedBoundary}`));

    for (const part of parts.slice(1, 10)) { // skip preamble, max 10 parts
      if (part.trim() === "--" || part.trim() === "") continue;

      const ctMatch = part.match(/Content-Type:\s*([^;\s]+)/i);
      const cteMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      const ct = (ctMatch?.[1] || "").toLowerCase();
      const cte = (cteMatch?.[1] || "").toLowerCase();

      // Skip attachments and nested multipart
      if (ct.includes("multipart/") || ct.includes("image/") || ct.includes("application/")) continue;

      const bodyIdx = part.search(/\r?\n\r?\n/);
      if (bodyIdx === -1) continue;
      let body = part.substring(bodyIdx).replace(/^\r?\n\r?\n/, "");

      if (cte.includes("base64")) body = decodeBase64(body);
      else if (cte.includes("quoted-printable")) body = decodeQuotedPrintable(body);

      if (ct.includes("text/html") && !htmlContent) {
        htmlContent = body;
      } else if (ct.includes("text/plain") && !textContent) {
        textContent = body;
      }
    }

    if (!textContent && htmlContent) {
      textContent = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    return { html: htmlContent, text: textContent };
  } catch (e) {
    console.error("Error parsing email body:", e);
    return { html: null, text: "" };
  }
}

const legalKeywords = [
  // Atos processuais
  "processo", "intimação", "intimacao", "citação", "citacao",
  "audiência", "audiencia", "sentença", "sentenca", "despacho",
  "mandado", "alvará", "alvara", "petição", "peticao",
  "recurso", "agravo", "apelação", "apelacao", "embargo",
  "contestação", "contestacao", "réplica", "replica",
  "impugnação", "impugnacao", "exceção", "excecao",
  "reconvenção", "reconvencao", "contradita",
  // Tribunais e sistemas
  "jus.br", "pje", "esaj", "projudi", "eproc", "e-proc", "sei",
  "tjsp", "tjrj", "tjmg", "tjba", "tjrs", "tjpr", "tjsc", "tjpe", "tjce", "tjgo", "tjdf",
  "tjal", "tjam", "tjap", "tjma", "tjms", "tjmt", "tjpa", "tjpb", "tjpi", "tjrn", "tjro", "tjrr", "tjse", "tjto", "tjes",
  "trf1", "trf2", "trf3", "trf4", "trf5", "trf6",
  "stf", "stj", "tst", "trt", "tre", "tse",
  "tribunal", "vara", "juiz", "juízo", "juizo", "comarca", "fórum", "forum",
  "turma recursal", "juizado especial", "juizado",
  // Partes e profissionais
  "réu", "reu", "autor", "advogad", "oab", "procuração", "procuracao",
  "requerente", "requerido", "exequente", "executado", "impetrante",
  "reclamante", "reclamado", "apelante", "apelado", "agravante", "agravado",
  "litisconsorte", "assistente", "interveniente", "curador", "tutor",
  "defensor", "promotor", "ministério público", "ministerio publico",
  // Documentos e procedimentos
  "diligência", "diligencia", "prazo", "prazo fatal", "prazo processual",
  "cnj", "distribuição", "distribuicao", "protocolo", "certidão", "certidao",
  "oficial de justiça", "oficial de justica",
  "carta precatória", "carta precatoria", "carta rogatória", "carta rogatoria",
  "edital", "publicação", "publicacao", "dje", "diário oficial", "diario oficial",
  "execução", "execucao", "penhora", "leilão", "leilao", "hasta pública", "hasta publica",
  "arresto", "sequestro", "bloqueio", "bacenjud", "renajud", "infojud", "sisbajud",
  // Áreas do direito de família
  "inventário", "inventario", "divórcio", "divorcio", "separação", "separacao",
  "pensão", "pensao", "alimentos", "guarda", "tutela", "curatela",
  "adoção", "adocao", "união estável", "uniao estavel",
  "partilha", "meação", "meacao", "regime de bens",
  "alienação parental", "alienacao parental",
  "regulamentação de visitas", "regulamentacao de visitas",
  // Decisões e recursos
  "habeas corpus", "mandamus", "liminar", "tutela antecipada", "tutela provisória", "tutela provisoria",
  "antecipação de tutela", "antecipacao de tutela", "efeito suspensivo",
  "indenização", "indenizacao", "dano moral", "dano material",
  "trabalhista", "reclamação", "reclamacao",
  "previdenciário", "previdenciario", "inss", "benefício", "beneficio",
  "honorários", "honorarios", "custas", "emolumentos", "sucumbência", "sucumbencia",
  "acórdão", "acordao", "jurisprudência", "jurisprudencia", "súmula", "sumula",
  "trânsito em julgado", "transito em julgado", "coisa julgada",
  // Contratos e obrigações
  "contrato", "cláusula", "clausula", "rescisão", "rescisao",
  "notificação extrajudicial", "notificacao extrajudicial",
  "escritura", "procuração", "procuracao", "substabelecimento",
  // Termos comuns em e-mails de sistemas judiciais
  "movimentação", "movimentacao", "andamento processual", "andamento",
  "consulta processual", "acompanhamento", "push",
  "numeração única", "numeracao unica", "número do processo", "numero do processo",
  "comprovante de protocolo", "recibo",
  "pauta de julgamento", "pauta de audiência", "pauta de audiencia",
  "escavador", "jusbrasil",
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
  let password: string;
  try {
    password = atob(account.imap_password);
  } catch {
    password = account.imap_password;
  }
  password = password.replace(/\s/g, "");

  const conn = await Deno.connectTls({
    hostname: account.imap_host,
    port: account.imap_port,
  });

  // Read greeting
  const greetBuf = new Uint8Array(4096);
  await conn.read(greetBuf);

  // AUTHENTICATE PLAIN
  const credentials = btoa(`\0${account.imap_user}\0${password}`);
  const loginResp = await imapCommand(
    conn,
    "A001",
    `AUTHENTICATE PLAIN ${credentials}`
  );
  if (!loginResp.includes("A001 OK")) {
    conn.close();
    throw new Error("Login failed");
  }

  // SELECT INBOX
  await imapCommand(conn, "A002", "SELECT INBOX");

  // SEARCH for recent emails (last 3 days for speed)
  const since = new Date();
  since.setDate(since.getDate() - 3);
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

  // Process only the last 10 emails to avoid timeout
  for (const uid of uids.slice(-10)) {
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
    const { html: bodyHtml, text: bodyText } = extractEmailBody(fetchResp);

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
      .in("provider", ["hostinger", "imap"])
      .in("status", ["conectado", "sincronizando"]);

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
