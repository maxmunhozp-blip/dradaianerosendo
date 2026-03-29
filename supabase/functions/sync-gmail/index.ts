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

interface EmailAccount {
  id: string;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  gmail_message_id_cursor: string | null;
  platform: string;
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

async function fetchGmailMessages(
  accessToken: string,
  cursor: string | null
): Promise<{ messages: any[]; nextCursor: string | null }> {
  const query = "from:(*@*.jus.br OR *@pje.jus.br) newer_than:3d";
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const messages = data.messages || [];
  return { messages, nextCursor: messages.length > 0 ? messages[0].id : cursor };
}

async function fetchMessageContent(
  accessToken: string,
  messageId: string
): Promise<{ subject: string; body: string; from: string; date: string }> {
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

  let body = "";
  const extractBody = (part: any): string => {
    if (part.body?.data) {
      return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    }
    if (part.parts) {
      for (const p of part.parts) {
        const result = extractBody(p);
        if (result) return result;
      }
    }
    return "";
  };

  body = extractBody(msg.payload);

  return {
    subject: getHeader("Subject"),
    body: body.substring(0, 10000),
    from: getHeader("From"),
    date: getHeader("Date"),
  };
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

    // Fetch accounts to sync
    let query = admin.from("email_accounts").select("*").eq("status", "conectado");
    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accErr } = await query;
    if (accErr) throw accErr;

    let totalNew = 0;

    for (const account of (accounts || []) as EmailAccount[]) {
      let token = account.access_token;

      if (!token && !account.refresh_token) {
        await admin
          .from("email_accounts")
          .update({ status: "erro" })
          .eq("id", account.id);
        continue;
      }

      // Try token, refresh if needed
      let tokenRefreshed = false;
      if (account.refresh_token) {
        // Always try to refresh for freshness
        const newToken = await refreshAccessToken(account.refresh_token);
        if (newToken) {
          token = newToken;
          tokenRefreshed = true;
        }
      }

      if (!token) {
        await admin
          .from("email_accounts")
          .update({ status: "erro" })
          .eq("id", account.id);
        continue;
      }

      try {
        const { messages, nextCursor } = await fetchGmailMessages(
          token,
          account.gmail_message_id_cursor
        );

        let newCount = 0;
        for (const msg of messages) {
          // Check if already processed
          const { data: existing } = await admin
            .from("intimacoes")
            .select("id")
            .eq("gmail_message_id", msg.id)
            .maybeSingle();

          if (existing) continue;

          // Fetch full message
          const content = await fetchMessageContent(token, msg.id);

          // Call process-intimacao
          const processRes = await fetch(
            `${SUPABASE_URL}/functions/v1/process-intimacao`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                subject: content.subject,
                body: content.body,
                from_email: content.from,
                date: content.date,
                gmail_message_id: msg.id,
              }),
            }
          );

          if (processRes.ok) {
            newCount++;
          }
          await processRes.text(); // consume
        }

        // Update account
        const updates: Record<string, any> = {
          last_sync: new Date().toISOString(),
          status: "conectado",
        };
        if (nextCursor) updates.gmail_message_id_cursor = nextCursor;
        if (tokenRefreshed) updates.access_token = token;

        await admin.from("email_accounts").update(updates).eq("id", account.id);
        totalNew += newCount;
      } catch (err) {
        console.error(`Error syncing account ${account.id}:`, err);
        await admin
          .from("email_accounts")
          .update({ status: "erro" })
          .eq("id", account.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, new_intimacoes: totalNew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-gmail error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
