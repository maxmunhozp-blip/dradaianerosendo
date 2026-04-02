import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    console.log("ZapSign webhook payload:", JSON.stringify(payload));

    const eventType = pickFirstString(
      payload.event_type,
      payload.type,
      payload.event,
      payload.webhook_type,
      payload.name,
      payload.data?.event_type,
    )?.toLowerCase();

    const status = pickFirstString(
      payload.status,
      payload.data?.status,
      payload.doc?.status,
      payload.document?.status,
      payload.data?.document_status,
    )?.toLowerCase();

    const docToken = pickFirstString(
      payload.token,
      payload.data?.token,
      payload.doc?.token,
      payload.document?.token,
      payload.doc_token,
      payload.data?.doc_token,
      payload.doc?.doc_token,
      payload.document?.doc_token,
      payload.open_id,
      payload.data?.open_id,
      payload.doc?.open_id,
      payload.document?.open_id,
    );

    const signerPayload =
      payload.signers ??
      payload.data?.signers ??
      payload.doc?.signers ??
      payload.document?.signers ??
      null;

    const isSigned = eventType?.includes("signed") || status === "finished" || status === "signed";
    const isRejected = eventType?.includes("refused") || eventType?.includes("reject") || status === "refused" || status === "rejected";

    if (!docToken) {
      return new Response(JSON.stringify({ ok: true, ignored: "missing_token" }), { status: 200, headers: corsHeaders });
    }

    const signatureStatus = isSigned ? "signed" : isRejected ? "rejected" : null;

    console.log("Resolved ZapSign webhook:", JSON.stringify({ eventType, status, docToken, signatureStatus }));

    if (!signatureStatus) {
      return new Response(JSON.stringify({ ok: true, ignored: "unsupported_status" }), { status: 200, headers: corsHeaders });
    }

    const { data: existingDoc, error: fetchDocError } = await supabase
      .from("documents")
      .select("id, name, case_id, owner_id, signature_status")
      .eq("signature_doc_token", docToken)
      .maybeSingle();

    if (fetchDocError) {
      console.error("Failed to fetch document by token:", fetchDocError);
      return new Response(JSON.stringify({ ok: true, ignored: "fetch_error" }), { status: 200, headers: corsHeaders });
    }

    if (!existingDoc) {
      console.log("Document not found for token:", docToken);
      return new Response(JSON.stringify({ ok: true, ignored: "document_not_found" }), { status: 200, headers: corsHeaders });
    }

    if (existingDoc.signature_status === signatureStatus) {
      console.log("Webhook already processed for document:", existingDoc.id);
      return new Response(JSON.stringify({ ok: true, ignored: "already_processed" }), { status: 200, headers: corsHeaders });
    }

    const updatePayload: Record<string, unknown> = {
      signature_status: signatureStatus,
      signature_completed_at: new Date().toISOString(),
    };

    if (Array.isArray(signerPayload)) {
      updatePayload.signers = signerPayload;
    }

    const { data: updatedDoc, error: updateError } = await supabase
      .from("documents")
      .update(updatePayload)
      .eq("id", existingDoc.id)
      .select("id, name, case_id, owner_id")
      .single();

    if (updateError || !updatedDoc) {
      console.error("Failed to update document signature status:", updateError);
      return new Response(JSON.stringify({ ok: true, ignored: "update_error" }), { status: 200, headers: corsHeaders });
    }

    const doc = updatedDoc;

    // Get case + client info for notification
    const { data: caseData } = await supabase
      .from("cases")
      .select("id, case_type, client_id, clients:client_id(name, phone)")
      .eq("id", doc.case_id)
      .single();

    const clientName = (caseData as any)?.clients?.name || "Cliente";
    const clientPhone = (caseData as any)?.clients?.phone;
    const caseType = caseData?.case_type || "";

    // Create timeline event
    await supabase.from("case_timeline").insert({
      case_id: doc.case_id,
      owner_id: doc.owner_id,
      title: signatureStatus === "signed"
        ? `Documento "${doc.name}" assinado`
        : `Assinatura do documento "${doc.name}" recusada`,
      description: signatureStatus === "signed"
        ? `O documento "${doc.name}" foi assinado eletronicamente via ZapSign por ${clientName}.`
        : `A assinatura do documento "${doc.name}" foi recusada via ZapSign.`,
      type: "assinatura",
      status: signatureStatus === "signed" ? "concluído" : "atenção_necessária",
    });

    // Send WhatsApp notification to the lawyer (office phone from settings)
    const { data: officeSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "office_phone")
      .single();

    const officePhone = officeSetting?.value;

    if (officePhone) {
      const emoji = signatureStatus === "signed" ? "✅" : "❌";
      const statusText = signatureStatus === "signed" ? "ASSINADO" : "RECUSADO";
      const message = `${emoji} *Assinatura Digital — ${statusText}*\n\nDocumento: ${doc.name}\nCliente: ${clientName}\nCaso: ${caseType}\n\nAcesse o sistema para mais detalhes.`;

      try {
        await supabase.functions.invoke("whatsapp", {
          body: { phone: officePhone.replace(/\D/g, ""), message },
        });
        console.log("WhatsApp notification sent to office");
      } catch (e) {
        console.error("Failed to send WhatsApp notification:", e);
      }
    }

    // If signed and client has phone, send confirmation to client too
    if (signatureStatus === "signed" && clientPhone) {
      const clientMsg = `✅ Olá ${clientName}! Confirmamos o recebimento da sua assinatura no documento "${doc.name}". Obrigado!`;
      try {
        await supabase.functions.invoke("whatsapp", {
          body: { phone: clientPhone.replace(/\D/g, ""), message: clientMsg },
        });
        console.log("WhatsApp confirmation sent to client");
      } catch (e) {
        console.error("Failed to send client WhatsApp:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, status: signatureStatus, document_id: doc.id }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ ok: true, ignored: "unexpected_error" }), { status: 200, headers: corsHeaders });
  }
});
