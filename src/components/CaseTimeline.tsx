import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Upload,
  FileText,
  MessageSquare,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineEvent {
  id: string;
  type: "upload" | "status" | "message" | "checklist" | "peticao";
  title: string;
  description?: string;
  date: string;
  icon: typeof Upload;
  color: string;
}

interface CaseTimelineProps {
  documents: any[];
  messages: any[];
  checklist: any[];
  caseCreatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  documentacao: "Documentação",
  montagem: "Montagem",
  protocolo: "Protocolo",
  andamento: "Em andamento",
  encerrado: "Encerrado",
};

export function CaseTimeline({ documents, messages, checklist, caseCreatedAt }: CaseTimelineProps) {
  const events = useMemo(() => {
    const items: TimelineEvent[] = [];

    // Case creation
    items.push({
      id: "case-created",
      type: "status",
      title: "Caso criado",
      description: "Caso registrado no sistema",
      date: caseCreatedAt,
      icon: Clock,
      color: "text-primary",
    });

    // Documents
    documents.forEach((doc) => {
      const isPeticao = doc.category === "processo";
      items.push({
        id: `doc-${doc.id}`,
        type: isPeticao ? "peticao" : "upload",
        title: isPeticao ? "Petição Inicial gerada" : `Documento ${doc.status === "recebido" ? "recebido" : "solicitado"}`,
        description: doc.name,
        date: doc.created_at,
        icon: isPeticao ? Scale : FileText,
        color: isPeticao ? "text-primary" : "text-emerald-600",
      });
    });

    // Messages (only show user/assistant, not system)
    messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .forEach((msg) => {
        items.push({
          id: `msg-${msg.id}`,
          type: "message",
          title: msg.role === "user" ? "Mensagem enviada" : "LARA respondeu",
          description: msg.content.length > 80 ? msg.content.substring(0, 80) + "…" : msg.content,
          date: msg.created_at,
          icon: MessageSquare,
          color: msg.role === "user" ? "text-amber-500" : "text-blue-500",
        });
      });

    // Checklist items
    checklist.forEach((item) => {
      items.push({
        id: `check-${item.id}`,
        type: "checklist",
        title: item.done ? "Checklist concluído" : "Checklist adicionado",
        description: item.label,
        date: item.created_at,
        icon: CheckCircle2,
        color: item.done ? "text-emerald-600" : "text-muted-foreground",
      });
    });

    // Sort by date descending (most recent first)
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [documents, messages, checklist, caseCreatedAt]);

  if (events.length <= 1) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Timeline ({events.length})
      </h2>
      <div className="border border-border rounded-lg">
        <ScrollArea className="max-h-[400px]">
          <div className="p-4">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-0">
                {events.map((event, index) => {
                  const Icon = event.icon;
                  const isFirst = index === 0;
                  return (
                    <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {/* Icon circle */}
                      <div
                        className={`relative z-10 flex items-center justify-center w-[31px] h-[31px] rounded-full border-2 shrink-0 ${
                          isFirst
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background"
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${event.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {event.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                          >
                            {format(new Date(event.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </Badge>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
