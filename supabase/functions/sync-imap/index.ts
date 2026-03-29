import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_BODY_SIZE = 100 * 1024; // 100KB

const FINANCIAL_KEYWORDS = [
  "boleto", "pagamento", "fatura", "honorários", "honorarios",
  "cobrança", "cobranca", "recibo", "nota fiscal", "nf-e", "nfe",
];

interface ImapAccount {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  gmail_message_id_cursor: string | null;
  platform: string;
  sync_limit: number;
  sync_subject_filters: string[];
  sync_judicial_only: boolean;
  sync_extra_senders: string;
  sync_attachments: boolean;
  sync_attachments_pdf_only: boolean;
  sync_period_days: number;
  sync_configured: boolean;
  sync_import_all: boolean;
  sync_financial: boolean;
  sync_extra_domains: string;
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
          const bin = atob(text.replace(/\s/g, ""));
          bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        } else {
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

function normalizeCharset(charset: string): string {
  const c = charset.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const map: Record<string, string> = {
    "latin1": "iso-8859-1",
    "iso88591": "iso-8859-1",
    "windows1252": "windows-1252",
    "cp1252": "windows-1252",
    "ascii": "utf-8",
    "usascii": "utf-8",
    "utf8": "utf-8",
  };
  return map[c] || charset.toLowerCase();
}

function extractCharset(headerBlock: string): string {
  const match = headerBlock.match(/charset\s*=\s*"?([^";\s]+)"?/i);
  return match ? normalizeCharset(match[1]) : "utf-8";
}

function decodeBase64WithCharset(str: string, charset = "utf-8"): string {
  try {
    const cleaned = str.replace(/\s/g, "");
    const bin = atob(cleaned);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder(normalizeCharset(charset)).decode(bytes);
  } catch {
    try {
      const cleaned = str.replace(/\s/g, "");
      const bin = atob(cleaned);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return str;
    }
  }
}

function decodeQuotedPrintableWithCharset(str: string, charset = "utf-8"): string {
  try {
    const decoded = str
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    return new TextDecoder(normalizeCharset(charset)).decode(bytes);
  } catch {
    return str
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
  }
}

function extractEmailBody(raw: string): { html: string | null; text: string } {
  try {
    let htmlContent: string | null = null;
    let textContent = "";

    const boundaryMatch = raw.match(/boundary="?([^"\s;]+)"?/i);

    if (!boundaryMatch) {
      const cteMatch = raw.match(/^Content-Transfer-Encoding:\s*(.+)$/im);
      const cte = (cteMatch?.[1] || "").trim().toLowerCase();
      const ctMatch = raw.match(/^Content-Type:\s*([^;\s]+)/im);
      const ct = (ctMatch?.[1] || "").toLowerCase();
      const headerEnd = raw.search(/\r?\n\r?\n/);
      const headerBlock = headerEnd > 0 ? raw.substring(0, headerEnd) : raw;
      const charset = extractCharset(headerBlock);

      const bodyStart = raw.search(/\r?\n\r?\n/);
      if (bodyStart === -1) return { html: null, text: "" };
      let body = raw.substring(bodyStart).replace(/^\r?\n\r?\n/, "");

      if (cte.includes("base64")) body = decodeBase64WithCharset(body, charset);
      else if (cte.includes("quoted-printable")) body = decodeQuotedPrintableWithCharset(body, charset);

      if (ct.includes("text/html")) {
        return { html: body, text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
      }
      return { html: null, text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
    }

    const escapedBoundary = boundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = raw.split(new RegExp(`--${escapedBoundary}`));

    for (const part of parts.slice(1, 10)) {
      if (part.trim() === "--" || part.trim() === "") continue;

      const ctMatch = part.match(/Content-Type:\s*([^;\s]+)/i);
      const cteMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      const ct = (ctMatch?.[1] || "").toLowerCase();
      const cte = (cteMatch?.[1] || "").toLowerCase();
      const partHeaderEnd = part.search(/\r?\n\r?\n/);
      const partHeader = partHeaderEnd > 0 ? part.substring(0, partHeaderEnd) : part;
      const charset = extractCharset(partHeader);

      if (ct.includes("multipart/") || ct.includes("image/") || ct.includes("application/")) continue;

      const bodyIdx = part.search(/\r?\n\r?\n/);
      if (bodyIdx === -1) continue;
      let body = part.substring(bodyIdx).replace(/^\r?\n\r?\n/, "");

      if (cte.includes("base64")) body = decodeBase64WithCharset(body, charset);
      else if (cte.includes("quoted-printable")) body = decodeQuotedPrintableWithCharset(body, charset);

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

// Categorize email
function categorizeEmail(fromEmail: string, subject: string, bodyText: string): string {
  if (/\.jus\.br/i.test(fromEmail)) return "judicial";
  const textToCheck = `${subject} ${bodyText}`.toLowerCase();
  if (FINANCIAL_KEYWORDS.some(kw => textToCheck.includes(kw))) return "financial";
  return "other";
}

// Check if email matches user's configured filters
function matchesFilters(
  subject: string,
  fromEmail: string,
  bodyText: string,
  account: ImapAccount
): boolean {
  // If import_all is enabled, skip all filters
  if (account.sync_import_all) return true;

  // Account's own domain always passes
  const accountDomain = account.imap_user?.split("@")[1]?.toLowerCase();
  if (accountDomain && fromEmail.toLowerCase().includes(accountDomain)) return true;

  const isJudicial = /\.jus\.br/i.test(fromEmail);
  const textToCheck = `${subject} ${bodyText}`.toLowerCase();
  const isFinancial = FINANCIAL_KEYWORDS.some(kw => textToCheck.includes(kw));

  // Financial emails pass if sync_financial is on
  if (account.sync_financial && isFinancial) return true;

  // Extra domains bypass judicial filter
  if (account.sync_extra_domains) {
    const domains = account.sync_extra_domains.split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
    if (domains.some(d => fromEmail.toLowerCase().includes(d))) return true;
  }

  // If judicial-only is on, non-judicial emails need to match extra senders
  if (account.sync_judicial_only) {
    let senderMatch = isJudicial;
    if (!senderMatch && account.sync_extra_senders) {
      const extras = account.sync_extra_senders.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      senderMatch = extras.some(s => fromEmail.toLowerCase().includes(s));
    }
    if (!senderMatch) return false;
  }

  // Check subject filters
  const filters = account.sync_subject_filters || [];
  if (filters.length > 0) {
    const hasMatch = filters.some(kw => textToCheck.includes(kw.toLowerCase()));
    if (!hasMatch && !isJudicial) return false;
  }

  return true;
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
  console.log(`[sync-imap] Starting sync for account ${account.id} (${account.email})`);
  
  // Try plain text first; if it looks like base64, decode it (legacy migration)
  let password = account.imap_password.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/]+=*$/.test(password) && password.length > 8) {
    try {
      const decoded = atob(password);
      // If decoding produces printable ASCII, it was likely btoa-encoded
      if (/^[\x20-\x7E]+$/.test(decoded) && decoded.length >= 4) {
        console.log(`[sync-imap] Password appears base64-encoded, decoding...`);
        password = decoded;
        // Fix the stored password for future syncs
        await admin.from("email_accounts").update({ imap_password: password }).eq("id", account.id);
      }
    } catch { /* not base64, use as-is */ }
  }

  console.log(`[sync-imap] Connecting to ${account.imap_host}:${account.imap_port}...`);
  const conn = await Deno.connectTls({
    hostname: account.imap_host,
    port: account.imap_port,
  });

  const greetBuf = new Uint8Array(4096);
  await conn.read(greetBuf);
  console.log(`[sync-imap] Connected, authenticating...`);

  const credentials = btoa(`\0${account.imap_user}\0${password}`);
  const loginResp = await imapCommand(conn, "A001", `AUTHENTICATE PLAIN ${credentials}`);
  if (!loginResp.includes("A001 OK")) {
    conn.close();
    console.error(`[sync-imap] Login failed for ${account.email}`);
    throw new Error("Login failed");
  }
  console.log(`[sync-imap] Authenticated successfully`);

  await imapCommand(conn, "A002", "SELECT INBOX");
  console.log(`[sync-imap] INBOX selected`);

  // Build search command based on cursor
  const lastCursor = account.gmail_message_id_cursor;
  let searchCmd: string;

  if (lastCursor && parseInt(lastCursor) > 0) {
    // Fetch messages with UID greater than the last processed
    const nextUid = parseInt(lastCursor) + 1;
    searchCmd = `UID SEARCH UID ${nextUid}:*`;
    console.log(`[sync-imap] Incremental sync from UID ${nextUid}`);
  } else {
    // First sync: use date-based search
    const since = new Date();
    since.setDate(since.getDate() - (account.sync_period_days || 30));
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const imapDate = `${since.getUTCDate()}-${months[since.getUTCMonth()]}-${since.getUTCFullYear()}`;
    searchCmd = `UID SEARCH SINCE ${imapDate}`;
    console.log(`[sync-imap] First sync, searching since ${imapDate}`);
  }

  console.log(`[sync-imap] Search command: ${searchCmd}`);
  const searchResp = await imapCommand(conn, "A003", searchCmd);

  const searchLine = searchResp.split("\r\n").find((l) => l.startsWith("* SEARCH"));
  const allUids = searchLine
    ? searchLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean)
    : [];

  console.log(`[sync-imap] Found ${allUids.length} total messages`);

  // Limit to sync_limit (process most recent)
  const syncLimit = account.sync_limit || 100;
  const uids = allUids.slice(-Math.min(syncLimit, allUids.length));
  console.log(`[sync-imap] Processing last ${uids.length} messages (limit: ${syncLimit})`);

  let newCount = 0;
  let skippedExisting = 0;
  let skippedFilter = 0;
  let highestUid = parseInt(lastCursor || "0");

  for (const uid of uids) {
    const uidNum = parseInt(uid);
    if (uidNum > highestUid) highestUid = uidNum;

    // Check if already exists
    const { data: existing } = await admin
      .from("email_messages")
      .select("id")
      .eq("email_account_id", account.id)
      .eq("message_uid", uid)
      .maybeSingle();

    if (existing) {
      skippedExisting++;
      continue;
    }

    // FETCH entire message (read-only, does not mark as SEEN with BODY.PEEK)
    const fetchResp = await imapCommand(conn, `F${uid}`, `UID FETCH ${uid} BODY.PEEK[]`);

    const fromMatch = fetchResp.match(/^From:\s*(.+)$/im);
    const subjectMatch = fetchResp.match(/^Subject:\s*(.+(?:\r?\n\s+.+)*)$/im);
    const dateMatch = fetchResp.match(/^Date:\s*(.+)$/im);

    const fromRaw = decodeRfc2047(fromMatch?.[1]?.trim() || "");
    const subject = decodeRfc2047(
      (subjectMatch?.[1] || "").replace(/\r?\n\s+/g, " ").trim()
    ) || "(sem assunto)";
    const dateStr = dateMatch?.[1]?.trim() || "";

    const emailExtract = fromRaw.match(/<([^>]+)>/);
    const fromEmail = emailExtract ? emailExtract[1] : fromRaw;
    const fromName = emailExtract
      ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/"/g, "")
      : "";

    const { html: bodyHtml, text: bodyText } = extractEmailBody(fetchResp);

    // Apply user's configured filters
    if (!matchesFilters(subject, fromEmail, bodyText, account)) {
      skippedFilter++;
      continue;
    }

    const category = categorizeEmail(fromEmail, subject, bodyText);
    const isJudicial = category === "judicial";

    // Storage protection: truncate large bodies
    let finalBodyText = (bodyText || "").substring(0, 10000);
    let finalBodyHtml = bodyHtml;

    if (finalBodyHtml && finalBodyHtml.length > MAX_BODY_SIZE) {
      finalBodyHtml = finalBodyHtml.substring(0, MAX_BODY_SIZE);
      console.log(`[sync-imap] Body truncated for email: "${subject}"`);
    }

    // Save email
    await admin.from("email_messages").insert({
      email_account_id: account.id,
      message_uid: uid,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      body_text: finalBodyText,
      body_html: finalBodyHtml,
      received_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      is_read: false,
      is_judicial: isJudicial,
      category,
    });

    // Try to link to case and create timeline entry
    try {
      const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/;
      const cnjMatch = (subject + " " + bodyText).match(cnjPattern);

      let linkedCaseId: string | null = null;
      if (cnjMatch) {
        const { data: matchedCase } = await admin
          .from("cases")
          .select("id")
          .eq("cnj_number", cnjMatch[1])
          .maybeSingle();
        if (matchedCase) linkedCaseId = matchedCase.id;
      }

      if (linkedCaseId) {
        const cleanBody = (bodyText || "").substring(0, 2000);
        await admin.from("case_timeline").insert({
          case_id: linkedCaseId,
          type: "automatic",
          status: "atualização_recebida",
          title: subject,
          description: cleanBody,
          event_date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          responsible: fromName || fromEmail,
        });
        console.log(`[sync-imap] Timeline entry created for case ${linkedCaseId}`);
      }
    } catch (e) {
      console.error("[sync-imap] Error creating timeline entry:", e);
    }

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
        console.error("[sync-imap] Error processing intimacao:", e);
      }
    }

    newCount++;
  }

  // Save highest UID as cursor for next sync
  if (highestUid > 0) {
    await admin
      .from("email_accounts")
      .update({ gmail_message_id_cursor: String(highestUid) })
      .eq("id", account.id);
    console.log(`[sync-imap] Saved cursor UID: ${highestUid}`);
  }

  await imapCommand(conn, "A099", "LOGOUT");
  conn.close();

  console.log(`[sync-imap] Sync complete for ${account.email}: ${newCount} new, ${skippedExisting} existing, ${skippedFilter} filtered out`);
  return newCount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[sync-imap] Function invoked");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let accountId: string | undefined;
    try {
      const body = await req.json();
      accountId = body.accountId || body.account_id;
      console.log(`[sync-imap] Account ID: ${accountId || "all"}`);
    } catch {
      console.log("[sync-imap] No body provided, syncing all accounts");
    }

    let query = admin
      .from("email_accounts")
      .select("*")
      .in("provider", ["hostinger", "imap", "gmail"])
      .in("status", ["conectado", "sincronizando"]);

    if (accountId) query = query.eq("id", accountId);

    const { data: accounts, error: accErr } = await query;
    if (accErr) {
      console.error("[sync-imap] Error fetching accounts:", accErr);
      throw accErr;
    }

    console.log(`[sync-imap] Found ${accounts?.length || 0} accounts to sync`);

    // Filter accounts: manual sync (accountId) ignores sync_configured; cron respects it
    const imapAccounts = (accounts || []).filter(
      (a: any) => a.imap_host && a.imap_user && a.imap_password && (accountId || a.sync_configured !== false)
    ) as ImapAccount[];

    console.log(`[sync-imap] ${imapAccounts.length} accounts with IMAP credentials`);

    let totalNew = 0;

    for (const account of imapAccounts) {
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
        console.error(`[sync-imap] Error syncing account ${account.id}:`, err);
        await admin
          .from("email_accounts")
          .update({ 
            status: "erro",
            sync_error_message: err instanceof Error ? err.message : String(err)
          })
          .eq("id", account.id);
      }
    }

    console.log(`[sync-imap] Total new emails: ${totalNew}`);

    return new Response(
      JSON.stringify({ success: true, new_emails: totalNew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-imap] Fatal error:", err);
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
