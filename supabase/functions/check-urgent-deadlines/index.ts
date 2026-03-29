import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find intimações with deadline < 48h from now, not yet alerted
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: urgent, error } = await supabase
      .from("intimacoes")
      .select("id, process_number, movement_type, deadline_date, tribunal, ai_summary")
      .eq("urgent_alert_sent", false)
      .not("deadline_date", "is", null)
      .gte("deadline_date", now.toISOString().split("T")[0])
      .lte("deadline_date", in48h.toISOString().split("T")[0]);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!urgent || urgent.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma intimação urgente encontrada", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load Z-API credentials
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["zapi_instance_id", "zapi_token", "office_phone"]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) settingsMap[s.key] = s.value;

    const hasZapi = settingsMap.zapi_instance_id && settingsMap.zapi_token && settingsMap.office_phone;
    let sentCount = 0;

    for (const item of urgent) {
      const deadlineStr = new Date(item.deadline_date + "T00:00:00").toLocaleDateString("pt-BR");

      if (hasZapi) {
        const phone = settingsMap.office_phone.replace(/\D/g, "");
        const msg = `⚠️ PRAZO URGENTE (<48h)\n\nProcesso: ${item.process_number || "não identificado"}\nTipo: ${item.movement_type || "Intimação"}\nTribunal: ${item.tribunal || "—"}\nPrazo: ${deadlineStr}\n\n${item.ai_summary || ""}\n\nAcesse o LexAI para tomar providências.`;

        try {
          await fetch(
            `https://api.z-api.io/instances/${settingsMap.zapi_instance_id}/token/${settingsMap.zapi_token}/send-text`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: `55${phone}`, message: msg }),
            }
          );
          sentCount++;
        } catch (e) {
          console.error("WhatsApp send error for", item.id, e);
        }
      }

      // Mark as alerted
      await supabase
        .from("intimacoes")
        .update({ urgent_alert_sent: true })
        .eq("id", item.id);
    }

    return new Response(
      JSON.stringify({ success: true, found: urgent.length, whatsapp_sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-urgent-deadlines error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
