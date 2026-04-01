import { usePortalSession } from "@/components/ClientPortalLayout";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FileText, MessageSquare, Clock, Download, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CaseStatusStepper } from "@/components/CaseStatusStepper";
import { Skeleton } from "@/components/ui/skeleton";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

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

  const { data: timeline = [] } = useQuery({
    queryKey: ["portal-timeline", caseItem?.id],
    queryFn: async () => {
      const { data } = await pub.from("case_timeline").select("*").eq("case_id", caseItem!.id).order("event_date", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!caseItem,
  });

  // Check for active data request
  const { data: activeRequest } = useQuery({
    queryKey: ["portal-active-request", clientId],
    queryFn: async () => {
      const { data } = await pub.from("data_requests").select("token, status").eq("client_id", clientId!).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!clientId,
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

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
      {/* Case Status Card */}
      {caseItem && (
        <div style={{
          background: "linear-gradient(135deg, #1E3A5F, #2C5282)",
          borderRadius: 16, padding: "24px 20px", marginBottom: 16, color: "#fff",
        }}>
          <p style={{ fontFamily: "var(--wizard-font-display)", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            {caseItem.case_type}
          </p>
          <span style={{
            display: "inline-block", background: "rgba(255,255,255,.2)", borderRadius: 20,
            padding: "4px 14px", fontSize: 13, fontWeight: 600, marginBottom: 16,
          }}>
            {statusLabels[caseItem.status] || caseItem.status}
          </span>
          <div style={{ background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 16px" }}>
            <CaseStatusStepper currentStatus={caseItem.status} />
          </div>
        </div>
      )}

      {/* Alert Card — missing data */}
      {activeRequest && (
        <div style={{
          background: "#FFFBEB", border: "1px solid #B7791F", borderRadius: 12,
          padding: "16px 20px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={20} color="#B7791F" />
            <p style={{ fontSize: 14, color: "#744210", fontWeight: 600, lineHeight: 1.4 }}>
              Seu advogado precisa de mais informações para continuar seu processo.
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
          { icon: MessageSquare, label: "Falar com escritório", action: () => window.open("https://wa.me/5500000000000", "_blank") },
          { icon: Clock, label: "Ver andamentos", action: () => { /* scroll to timeline */ } },
          { icon: Download, label: "Minha procuração", action: () => { /* download */ } },
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--wizard-primary)", textAlign: "center" }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 16px", border: "1px solid #E5E7EB" }}>
          <p style={{ fontFamily: "var(--wizard-font-display)", fontSize: 16, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 16 }}>
            Atualizações recentes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {timeline.map((ev: any) => (
              <div key={ev.id} style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--wizard-accent)", marginTop: 6, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 14, color: "var(--wizard-primary)", fontWeight: 600 }}>{ev.title}</p>
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    {new Date(ev.event_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
