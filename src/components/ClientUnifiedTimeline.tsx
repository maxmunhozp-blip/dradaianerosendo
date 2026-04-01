import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText, PenLine, Bell, MessageSquare, Scale, AlertTriangle, CheckCircle2, Gavel, ClipboardCheck, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface TimelineEvent {
  id: string;
  case_id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  event_date: string;
  case_type?: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  documento: FileText,
  assinatura: PenLine,
  audiencia: Gavel,
  intimacao: AlertTriangle,
  mensagem: MessageSquare,
  manual: Clock,
  peticao: Scale,
  checklist: ClipboardCheck,
  timeline: Bell,
};

const TYPE_LABELS: Record<string, string> = {
  documento: "Documentos",
  assinatura: "Assinaturas",
  audiencia: "Audiências",
  intimacao: "Intimações",
  manual: "Manual",
  peticao: "Petições",
  checklist: "Checklist",
  timeline: "Timeline",
  mensagem: "Mensagens",
};

const STATUS_COLORS: Record<string, string> = {
  concluído: "text-green-600",
  assinado: "text-green-600",
  signed: "text-green-600",
  realizada: "text-green-600",
  done: "text-green-600",
  "atenção_necessária": "text-amber-600",
  pendente: "text-blue-600",
  sent: "text-blue-600",
  agendado: "text-blue-600",
  novo: "text-amber-500",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  if (hours < 24) return `há ${hours}h`;
  if (days < 7) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientUnifiedTimeline({ caseIds }: { caseIds: string[] }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["client-unified-timeline", caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];

      // Fetch case types for labels
      const { data: casesData } = await supabase
        .from("cases")
        .select("id, case_type")
        .in("id", caseIds);
      const caseTypeMap = new Map((casesData || []).map(c => [c.id, c.case_type]));

      // Fetch all sources in parallel
      const [tlRes, docRes, hearRes, intRes, checkRes] = await Promise.all([
        supabase
          .from("case_timeline")
          .select("id, case_id, title, description, type, status, event_date")
          .in("case_id", caseIds)
          .order("event_date", { ascending: false }),
        supabase
          .from("documents")
          .select("id, case_id, name, category, status, signature_status, created_at")
          .in("case_id", caseIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("hearings")
          .select("id, case_id, title, location, status, date")
          .in("case_id", caseIds)
          .order("date", { ascending: false }),
        supabase
          .from("intimacoes")
          .select("id, case_id, raw_email_subject, ai_summary, status, created_at, deadline_date")
          .in("case_id", caseIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("checklist_items")
          .select("id, case_id, label, done, created_at")
          .in("case_id", caseIds)
          .order("created_at", { ascending: false }),
      ]);

      const unified: TimelineEvent[] = [];

      // Timeline entries
      for (const e of tlRes.data || []) {
        unified.push({
          id: `tl-${e.id}`,
          case_id: e.case_id,
          title: e.title,
          description: e.description || "",
          type: e.type || "timeline",
          status: e.status || "",
          event_date: e.event_date,
          case_type: caseTypeMap.get(e.case_id) || "",
        });
      }

      // Documents
      for (const d of docRes.data || []) {
        const sigLabel = d.signature_status === "signed" ? " (assinado)" :
                         d.signature_status === "sent" ? " (aguardando assinatura)" : "";
        unified.push({
          id: `doc-${d.id}`,
          case_id: d.case_id,
          title: `📄 ${d.name}${sigLabel}`,
          description: `Categoria: ${d.category} · Status: ${d.status}`,
          type: d.signature_status && d.signature_status !== "none" ? "assinatura" : "documento",
          status: d.signature_status === "signed" ? "assinado" : d.status,
          event_date: d.created_at,
          case_type: caseTypeMap.get(d.case_id) || "",
        });
      }

      // Hearings
      for (const h of hearRes.data || []) {
        unified.push({
          id: `hear-${h.id}`,
          case_id: h.case_id,
          title: `⚖️ ${h.title}`,
          description: h.location ? `Local: ${h.location}` : "",
          type: "audiencia",
          status: h.status,
          event_date: h.date,
          case_type: caseTypeMap.get(h.case_id) || "",
        });
      }

      // Intimações
      for (const i of intRes.data || []) {
        unified.push({
          id: `int-${i.id}`,
          case_id: i.case_id || "",
          title: `⚠️ ${i.raw_email_subject || "Intimação"}`,
          description: i.ai_summary || "",
          type: "intimacao",
          status: i.status,
          event_date: i.created_at,
          case_type: i.case_id ? (caseTypeMap.get(i.case_id) || "") : "",
        });
      }

      // Checklist items completed
      for (const c of checkRes.data || []) {
        if (c.done) {
          unified.push({
            id: `chk-${c.id}`,
            case_id: c.case_id,
            title: `✅ ${c.label}`,
            description: "Item concluído",
            type: "checklist",
            status: "concluído",
            event_date: c.created_at,
            case_type: caseTypeMap.get(c.case_id) || "",
          });
        }
      }

      // Sort all by date descending
      unified.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

      return unified;
    },
    enabled: caseIds.length > 0,
  });

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          <Clock className="w-4 h-4" />
          Movimentações
        </div>
        <div className="border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
        <Clock className="w-4 h-4" />
        Movimentações ({events.length})
      </div>

      {events.length === 0 ? (
        <div className="border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
          Nenhuma movimentação registrada ainda.
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border max-h-[500px] overflow-y-auto">
          {events.map((event) => {
            const Icon = TYPE_ICONS[event.type] || Clock;
            const statusColor = STATUS_COLORS[event.status] || "text-muted-foreground";

            return (
              <div key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className={`mt-0.5 ${statusColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                    {event.case_type && (
                      <Link
                        to={`/cases/${event.case_id}`}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      >
                        {event.case_type}
                      </Link>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 mt-0.5">
                  {formatDate(event.event_date)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
