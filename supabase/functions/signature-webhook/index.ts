import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    const docToken = payload.open_id || payload.token;
    const status = payload.status;

    if (!docToken) {
      return new Response("OK", { status: 200 });
    }

    const signatureStatus = status === "finished" ? "signed" : status === "refused" ? "rejected" : null;

    if (signatureStatus) {
      await supabase
        .from("documents")
        .update({
          signature_status: signatureStatus,
          signature_completed_at: new Date().toISOString(),
        })
        .eq("signature_doc_token", docToken);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("OK", { status: 200 });
  }
});
