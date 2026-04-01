import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText, PenLine, Bell, MessageSquare, Scale, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface TimelineEvent {
  id: string;
  case_id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  event_date: string;
  created_at: string;
  case_type?: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  documento: FileText,
  assinatura: PenLine,
  audiencia: Bell,
  intimacao: AlertTriangle,
  mensagem: MessageSquare,
  manual: Clock,
  peticao: Scale,
};

const STATUS_COLORS: Record<string, string> = {
  concluído: "text-green-600",
  "atenção_necessária": "text-amber-600",
  pendente: "text-blue-600",
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
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function ClientUnifiedTimeline({ caseIds }: { caseIds: string[] }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["client-unified-timeline", caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];
      
      // Fetch timeline events for all cases
      const { data: timelineData, error: tlError } = await supabase
        .from("case_timeline")
        .select("id, case_id, title, description, type, status, event_date, created_at")
        .in("case_id", caseIds)
        .order("event_date", { ascending: false })
        .limit(50);
      
      if (tlError) throw tlError;

      // Fetch case types for labels
      const { data: casesData } = await supabase
        .from("cases")
        .select("id, case_type")
        .in("id", caseIds);

      const caseTypeMap = new Map((casesData || []).map(c => [c.id, c.case_type]));

      return (timelineData || []).map(e => ({
        ...e,
        case_type: caseTypeMap.get(e.case_id) || "",
      })) as TimelineEvent[];
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
        <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-y-auto">
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
