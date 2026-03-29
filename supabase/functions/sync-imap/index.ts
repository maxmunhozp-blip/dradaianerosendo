import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_BODY_SIZE = 100 * 1024; // 100KB

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

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
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

    const escapedBoundary = boundaryMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = raw.split(new RegExp(`--${escapedBoundary}`));

    for (const part of parts.slice(1, 10)) {
      if (part.trim() === "--" || part.trim() === "") continue;

      const ctMatch = part.match(/Content-Type:\s*([^;\s]+)/i);
      const cteMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
      const ct = (ctMatch?.[1] || "").toLowerCase();
      const cte = (cteMatch?.[1] || "").toLowerCase();

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

// Build IMAP search criteria from sync preferences
function buildSearchCriteria(account: ImapAccount): string {
  const since = new Date();
  since.setDate(since.getDate() - (account.sync_period_days || 30));
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const imapDate = `${since.getUTCDate()}-${months[since.getUTCMonth()]}-${since.getUTCFullYear()}`;
  return `SEARCH SINCE ${imapDate}`;
}

// Check if email matches user's configured filters
function matchesFilters(
  subject: string,
  fromEmail: string,
  bodyText: string,
  account: ImapAccount
): boolean {
  const isJudicial = /\.jus\.br/i.test(fromEmail);

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
    const textToCheck = `${subject} ${bodyText}`.toLowerCase();
    const hasMatch = filters.some(kw => textToCheck.includes(kw.toLowerCase()));
    // Also pass if judicial (always relevant)
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
  
  let password: string;
  try {
    password = atob(account.imap_password);
  } catch {
    password = account.imap_password;
  }
  password = password.replace(/\s/g, "");

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

  const searchCmd = buildSearchCriteria(account);
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

  for (const uid of uids) {
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

    // FETCH entire message
    const fetchResp = await imapCommand(conn, `F${uid}`, `FETCH ${uid} BODY[]`);

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

    const isJudicial = /\.jus\.br/i.test(fromEmail);

    // Storage protection: truncate large bodies
    let finalBodyText = (bodyText || "").substring(0, 10000);
    let finalBodyHtml = bodyHtml;
    let bodyTruncated = false;

    if (finalBodyHtml && finalBodyHtml.length > MAX_BODY_SIZE) {
      finalBodyHtml = finalBodyHtml.substring(0, MAX_BODY_SIZE);
      bodyTruncated = true;
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

    // Filter accounts that have IMAP configured
    const imapAccounts = (accounts || []).filter(
      (a: any) => a.imap_host && a.imap_user && a.imap_password
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
          .update({ status: "erro" })
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
