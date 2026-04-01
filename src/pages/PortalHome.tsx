import { useState } from "react";
import { usePortalSession } from "@/components/ClientPortalLayout";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FileText, MessageSquare, Clock, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

const STEPS = ["Abertura", "Documentação", "Petição", "Conclusão"];
const STATUS_TO_STEP: Record<string, number> = {
  documentacao: 1,
  montagem: 1,
  protocolo: 2,
  andamento: 2,
  encerrado: 3,
};

const statusLabels: Record<string, string> = {
  documentacao: "Documentação",
  montagem: "Montagem",
  protocolo: "Protocolo",
  andamento: "Em andamento",
  encerrado: "Encerrado",
};

export default function PortalHome() {
  const session = usePortalSession();
  const navigate = useNavigate();
  const clientId = session?.clientId;
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["portal-client-data", clientId],
    queryFn: async () => {
      const { data } = await pub.from("clients").select("*").eq("id", clientId!).maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["portal-cases-home", clientId],
    queryFn: async () => {
      const { data } = await pub.from("cases").select("*").eq("client_id", clientId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clientId,
  });

  const caseItem = cases[0];
  const currentStep = STATUS_TO_STEP[caseItem?.status] ?? 0;

  const { data: timeline = [] } = useQuery({
    queryKey: ["portal-timeline", caseItem?.id],
    queryFn: async () => {
      const { data } = await pub.from("case_timeline").select("*").eq("case_id", caseItem!.id).order("event_date", { ascending: false });
      return data || [];
    },
    enabled: !!caseItem,
  });

  const { data: activeRequest } = useQuery({
    queryKey: ["portal-active-request", clientId],
    queryFn: async () => {
      const { data } = await pub.from("data_requests").select("token, status").eq("client_id", clientId!).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // Get latest procuracao document
  const { data: procuracaoDoc } = useQuery({
    queryKey: ["portal-procuracao", caseItem?.id],
    queryFn: async () => {
      const { data } = await pub.from("documents")
        .select("file_url, name")
        .eq("case_id", caseItem!.id)
        .ilike("name", "%procura%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!caseItem,
  });

  // Get WhatsApp number from settings
  const { data: whatsappSetting } = useQuery({
    queryKey: ["portal-whatsapp-setting"],
    queryFn: async () => {
      const { data } = await pub.from("settings").select("value").eq("key", "whatsapp_number").maybeSingle();
      return data?.value || "5500000000000";
    },
  });

  const firstName = client?.name?.split(" ")[0] || session?.clientName?.split(" ")[0] || "";

  if (isLoading) {
    return (
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-40 w-full rounded-2xl mb-4" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const visibleTimeline = showAllTimeline ? timeline : timeline.slice(0, 5);

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
      {/* Greeting */}
      <p style={{
        fontFamily: "var(--wizard-font-display)", fontSize: 22,
        fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 16,
      }}>
        Olá, {firstName}!
      </p>

      {/* Case Status Card */}
      {caseItem && (
        <div style={{
          background: "linear-gradient(135deg, #1E3A5F, #2C5282)",
          borderRadius: 16, padding: "24px 20px", marginBottom: 16, color: "#fff",
        }}>
          <p style={{
            fontFamily: "var(--wizard-font-display)", fontSize: 20,
            fontWeight: 600, marginBottom: 8,
          }}>
            {caseItem.case_type}
          </p>
          <span style={{
            display: "inline-block", background: "rgba(255,255,255,.2)",
            borderRadius: 20, padding: "4px 14px", fontSize: 13,
            fontWeight: 600, marginBottom: 20,
          }}>
            {statusLabels[caseItem.status] || caseItem.status}
          </span>

          {/* Stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 4px" }}>
            {STEPS.map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: i <= currentStep
                      ? (i === currentStep ? "#2B9E8F" : "rgba(255,255,255,.8)")
                      : "rgba(255,255,255,.3)",
                    border: i === currentStep ? "2px solid rgba(255,255,255,.9)" : "none",
                    transition: "all .3s",
                  }} />
                  <span style={{
                    fontSize: 10, color: i <= currentStep ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.3)",
                    fontWeight: i === currentStep ? 700 : 400, whiteSpace: "nowrap",
                  }}>
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginTop: -14,
                    background: i < currentStep ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.15)",
                    marginLeft: 4, marginRight: 4,
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Card — missing data */}
      {activeRequest && (
        <div style={{
          background: "#FFFBEB", borderLeft: "4px solid #B7791F",
          borderRadius: 12, padding: "16px 20px", marginBottom: 16,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertCircle size={20} color="#B7791F" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 14, color: "#744210", fontWeight: 600, lineHeight: 1.4 }}>
              Sua advogada precisa de mais informações para continuar seu processo.
            </p>
          </div>
          <button
            onClick={() => navigate(`/dados/${activeRequest.token}`)}
            style={{
              width: "100%", minHeight: 48, borderRadius: 10, border: "none",
              background: "#B7791F", color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "var(--wizard-font-body)",
            }}
          >
            Preencher agora
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { icon: FileText, label: "Enviar documento", action: () => navigate("/portal/docs") },
          { icon: MessageSquare, label: "Falar com escritório", action: () => window.open(`https://wa.me/${whatsappSetting || "5500000000000"}`, "_blank") },
          { icon: Clock, label: "Ver meu processo", action: () => document.getElementById("portal-timeline")?.scrollIntoView({ behavior: "smooth" }) },
          { icon: Download, label: "Minha procuração", action: () => {
            if (procuracaoDoc?.file_url) window.open(procuracaoDoc.file_url, "_blank");
          }},
        ].map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            style={{
              background: "#fff", borderRadius: 12, padding: "16px 14px",
              border: "1px solid #E5E7EB", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              transition: "border-color .2s",
            }}
          >
            <item.icon size={22} color="var(--wizard-accent)" />
            <span style={{
              fontSize: 13, fontWeight: 600, color: "var(--wizard-primary)",
              textAlign: "center",
            }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div id="portal-timeline" style={{
          background: "#fff", borderRadius: 14, padding: "20px 16px",
          border: "1px solid #E5E7EB",
        }}>
          <p style={{
            fontFamily: "var(--wizard-font-display)", fontSize: 16,
            fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 16,
          }}>
            Atualizações recentes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            {/* Vertical connector line */}
            <div style={{
              position: "absolute", left: 3, top: 8, bottom: 8,
              width: 2, background: "#E5E7EB",
            }} />
            {visibleTimeline.map((ev: any, i: number) => (
              <div key={ev.id} style={{
                display: "flex", gap: 14, paddingBottom: i < visibleTimeline.length - 1 ? 16 : 0,
                position: "relative",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: i === 0 ? "var(--wizard-accent)" : "#CBD5E0",
                  marginTop: 5, flexShrink: 0, zIndex: 1,
                }} />
                <div>
                  <p style={{ fontSize: 14, color: "var(--wizard-primary)", fontWeight: 600 }}>
                    {ev.title}
                  </p>
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                    {new Date(ev.event_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {timeline.length > 5 && (
            <button
              onClick={() => setShowAllTimeline(!showAllTimeline)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "var(--wizard-accent)",
                marginTop: 12, fontFamily: "var(--wizard-font-body)",
              }}
            >
              {showAllTimeline ? "Mostrar menos" : "Ver tudo"}
              {showAllTimeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
