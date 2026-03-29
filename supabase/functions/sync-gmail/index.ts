import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const MAX_BODY_SIZE = 100 * 1024;

const FINANCIAL_KEYWORDS = [
  "boleto", "pagamento", "fatura", "honorários", "honorarios",
  "cobrança", "cobranca", "recibo", "nota fiscal", "nf-e", "nfe",
];

interface EmailAccount {
  id: string;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  gmail_message_id_cursor: string | null;
  platform: string;
  sync_period_days: number | null;
  sync_limit: number | null;
  sync_judicial_only: boolean | null;
  sync_extra_senders: string | null;
  sync_extra_domains: string | null;
  sync_subject_filters: string[] | null;
  sync_import_all: boolean | null;
  sync_financial: boolean | null;
  sync_configured: boolean | null;
}

function buildGmailQuery(account: EmailAccount, periodDays: number): string {
  let q = `newer_than:${periodDays}d`;

  // If import_all, no additional filters
  if (account.sync_import_all) return q;

  const fromFilters: string[] = [];

  if (account.sync_judicial_only) {
    fromFilters.push(
      "from:*@*.jus.br",
      "from:*@pje.jus.br",
      "from:*@cnj.jus.br",
    );
  }

  if (account.sync_extra_senders) {
    const extras = account.sync_extra_senders.split(",").map(s => s.trim()).filter(Boolean);
    extras.forEach(s => fromFilters.push(`from:${s}`));
  }

  if (account.sync_extra_domains) {
    const domains = account.sync_extra_domains.split(",").map(d => d.trim()).filter(Boolean);
    domains.forEach(d => fromFilters.push(`from:*@${d}`));
  }

  if (fromFilters.length > 0) {
    q += ` {${fromFilters.join(" ")}}`;
  }

  if (account.sync_subject_filters && account.sync_subject_filters.length > 0) {
    const subjects = account.sync_subject_filters
      .map(f => `subject:${f}`).join(" OR ");
    q += ` (${subjects})`;
  }

  return q;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

async function fetchGmailMessageIds(
  accessToken: string,
  query: string,
  maxResults: number,
  pageToken?: string | null
): Promise<{ messageIds: string[]; nextPageToken: string | null }> {
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  console.log(`[sync-gmail] Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const messageIds = (data.messages || []).map((m: any) => m.id);
  return { messageIds, nextPageToken: data.nextPageToken || null };
}

async function fetchMessageContent(
  accessToken: string,
  messageId: string
): Promise<{ subject: string; bodyText: string; bodyHtml: string | null; from: string; fromName: string; fromEmail: string; date: string }> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    await res.text();
    throw new Error(`Failed to fetch message ${messageId}`);
  }

  const msg = await res.json();
  const headers = msg.payload?.headers || [];

  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  let textBody = "";
  let htmlBody: string | null = null;

  function extractParts(part: any) {
    const mimeType = (part.mimeType || "").toLowerCase();
    if (part.body?.data) {
      const decoded = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      if (mimeType === "text/html" && !htmlBody) {
        htmlBody = decoded;
      } else if (mimeType === "text/plain" && !textBody) {
        textBody = decoded;
      }
    }
    if (part.parts) {
      for (const p of part.parts) extractParts(p);
    }
  }

  extractParts(msg.payload);

  if (!textBody && htmlBody) {
    textBody = htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const fromRaw = getHeader("From");
  const emailMatch = fromRaw.match(/<([^>]+)>/);
  const fromEmail = emailMatch ? emailMatch[1] : fromRaw;
  const fromName = emailMatch ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/"/g, "") : "";

  return {
    subject: getHeader("Subject") || "(sem assunto)",
    bodyText: textBody.substring(0, 10000),
    bodyHtml: htmlBody && htmlBody.length > MAX_BODY_SIZE ? htmlBody.substring(0, MAX_BODY_SIZE) : htmlBody,
    from: fromRaw,
    fromName,
    fromEmail,
    date: getHeader("Date"),
  };
}

function categorizeEmail(fromEmail: string, subject: string, bodyText: string): string {
  if (/\.jus\.br/i.test(fromEmail)) return "judicial";
  const textToCheck = `${subject} ${bodyText}`.toLowerCase();
  if (FINANCIAL_KEYWORDS.some(kw => textToCheck.includes(kw))) return "financial";
  return "other";
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
      accountId = body.account_id;
    } catch {
      // no body is fine
    }

    // Fetch accounts — only OAuth Gmail accounts (have refresh_token, no imap_password)
    let query = admin.from("email_accounts").select("*").eq("provider", "gmail");
    if (accountId) {
      query = query.eq("id", accountId);
    } else {
      // Cron: respect sync_configured
      query = query.in("status", ["conectado", "sincronizando"]);
    }

    const { data: accounts, error: accErr } = await query;
    if (accErr) throw accErr;

    // Filter to only OAuth accounts (have refresh_token, no imap_password)
    const oauthAccounts = (accounts || []).filter(
      (a: any) => a.refresh_token && !a.imap_password
    ) as EmailAccount[];

    let totalNew = 0;

    for (const account of oauthAccounts) {
      let token = account.access_token;

      if (!token && !account.refresh_token) {
        await admin.from("email_accounts").update({ status: "erro", sync_error_message: "Sem token OAuth" }).eq("id", account.id);
        continue;
      }

      // Refresh token
      if (account.refresh_token) {
        const newToken = await refreshAccessToken(account.refresh_token);
        if (newToken) {
          token = newToken;
        } else if (!token) {
          await admin.from("email_accounts").update({ status: "erro", sync_error_message: "Falha ao renovar token OAuth" }).eq("id", account.id);
          continue;
        }
      }

      try {
        await admin.from("email_accounts").update({ status: "sincronizando" }).eq("id", account.id);

        const periodDays = account.sync_period_days || 30;
        const maxResults = Math.min(account.sync_limit || 100, 500);
        const gmailQuery = buildGmailQuery(account, periodDays);

        console.log(`[sync-gmail] Account ${account.email}: query="${gmailQuery}", maxResults=${maxResults}`);

        // Fetch message IDs with pagination
        let allMessageIds: string[] = [];
        let pageToken: string | null | undefined = account.gmail_message_id_cursor;
        let pagesProcessed = 0;
        const maxPages = 5; // Safety limit

        // First page: don't use cursor as pageToken for fresh syncs
        // pageToken from Gmail is for pagination within a single search, not across syncs
        // For incremental sync, we rely on newer_than + dedup
        const { messageIds, nextPageToken } = await fetchGmailMessageIds(token!, gmailQuery, maxResults);
        allMessageIds = messageIds;
        console.log(`[sync-gmail] Found ${allMessageIds.length} messages on first page`);

        // Fetch additional pages if needed and available
        let currentPageToken = nextPageToken;
        while (currentPageToken && pagesProcessed < maxPages && allMessageIds.length < maxResults) {
          pagesProcessed++;
          const page = await fetchGmailMessageIds(token!, gmailQuery, maxResults, currentPageToken);
          allMessageIds = allMessageIds.concat(page.messageIds);
          currentPageToken = page.nextPageToken;
          console.log(`[sync-gmail] Page ${pagesProcessed + 1}: +${page.messageIds.length} messages`);
        }

        // Limit total
        allMessageIds = allMessageIds.slice(0, maxResults);
        console.log(`[sync-gmail] Processing ${allMessageIds.length} messages total`);

        let newCount = 0;

        for (const msgId of allMessageIds) {
          // Check if already in email_messages
          const { data: existing } = await admin
            .from("email_messages")
            .select("id")
            .eq("email_account_id", account.id)
            .eq("message_uid", msgId)
            .maybeSingle();

          if (existing) continue;

          // Fetch full message
          const content = await fetchMessageContent(token!, msgId);
          const category = categorizeEmail(content.fromEmail, content.subject, content.bodyText);
          const isJudicial = category === "judicial";

          // Save to email_messages
          await admin.from("email_messages").insert({
            email_account_id: account.id,
            message_uid: msgId,
            from_email: content.fromEmail,
            from_name: content.fromName,
            subject: content.subject,
            body_text: content.bodyText,
            body_html: content.bodyHtml,
            received_at: content.date ? new Date(content.date).toISOString() : new Date().toISOString(),
            is_read: false,
            is_judicial: isJudicial,
            category,
          });

          // If judicial, also process as intimação
          if (isJudicial) {
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/process-intimacao`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  subject: content.subject,
                  body: content.bodyText,
                  from_email: content.fromEmail,
                  date: content.date,
                  gmail_message_id: msgId,
                }),
              });
            } catch (e) {
              console.error("[sync-gmail] Error processing intimacao:", e);
            }
          }

          // Try to link to case timeline
          try {
            const cnjPattern = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/;
            const cnjMatch = (content.subject + " " + content.bodyText).match(cnjPattern);
            if (cnjMatch) {
              const { data: matchedCase } = await admin
                .from("cases")
                .select("id")
                .eq("cnj_number", cnjMatch[1])
                .maybeSingle();
              if (matchedCase) {
                await admin.from("case_timeline").insert({
                  case_id: matchedCase.id,
                  type: "automatic",
                  status: "atualização_recebida",
                  title: content.subject,
                  description: content.bodyText.substring(0, 2000),
                  event_date: content.date ? new Date(content.date).toISOString() : new Date().toISOString(),
                  responsible: content.fromName || content.fromEmail,
                });
              }
            }
          } catch (e) {
            console.error("[sync-gmail] Error creating timeline entry:", e);
          }

          newCount++;
        }

        // Update account
        await admin.from("email_accounts").update({
          last_sync: new Date().toISOString(),
          status: "conectado",
          access_token: token,
          sync_error_message: null,
        }).eq("id", account.id);

        totalNew += newCount;
        console.log(`[sync-gmail] Account ${account.email}: ${newCount} new emails imported`);
      } catch (err: any) {
        console.error(`[sync-gmail] Error syncing account ${account.id}:`, err);
        await admin.from("email_accounts").update({
          status: "erro",
          sync_error_message: err.message || "Erro desconhecido",
        }).eq("id", account.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, new_emails: totalNew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[sync-gmail] error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
