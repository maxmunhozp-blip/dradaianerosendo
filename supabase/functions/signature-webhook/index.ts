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
    console.log("ZapSign webhook payload:", JSON.stringify(payload));

    const docToken = payload.open_id || payload.token;
    const status = payload.status;

    if (!docToken) {
      return new Response("OK", { status: 200 });
    }

    const signatureStatus = status === "finished" ? "signed" : status === "refused" ? "rejected" : null;

    if (!signatureStatus) {
      return new Response("OK", { status: 200 });
    }

    // Update document status
    const { data: updatedDocs } = await supabase
      .from("documents")
      .update({
        signature_status: signatureStatus,
        signature_completed_at: new Date().toISOString(),
      })
      .eq("signature_doc_token", docToken)
      .select("id, name, case_id, owner_id");

    const doc = updatedDocs?.[0];
    if (!doc) {
      console.log("Document not found for token:", docToken);
      return new Response("OK", { status: 200 });
    }

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

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("OK", { status: 200 });
  }
});
