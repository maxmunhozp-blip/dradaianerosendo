import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText, PenLine, Bell, MessageSquare, Scale, AlertTriangle, CheckCircle2, Gavel, ClipboardCheck, Plus, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
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

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const MANUAL_TYPES = [
  { value: "manual", label: "Movimentação geral" },
  { value: "documento", label: "Documento" },
  { value: "audiencia", label: "Audiência" },
  { value: "peticao", label: "Petição" },
  { value: "timeline", label: "Atualização" },
];

const MANUAL_STATUSES = [
  { value: "atualização_recebida", label: "Atualização recebida" },
  { value: "concluído", label: "Concluído" },
  { value: "pendente", label: "Pendente" },
  { value: "atenção_necessária", label: "Atenção necessária" },
];

// Tab definitions — each maps to a set of event types
const TIMELINE_TABS = [
  { value: "geral", label: "Geral", types: null }, // null = all
  { value: "processo", label: "Processo", types: ["intimacao", "audiencia", "timeline"] },
  { value: "documentos", label: "Documentos", types: ["documento", "assinatura", "peticao"] },
  { value: "interno", label: "Interno", types: ["checklist", "manual"] },
] as const;

const PAGE_SIZE = 30;

export function ClientUnifiedTimeline({ caseIds }: { caseIds: string[] }) {
  const [activeTab, setActiveTab] = useState("geral");
  const [showAddForm, setShowAddForm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const qc = useQueryClient();

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
      const [msgRes, tlRes, docRes, hearRes, intRes, checkRes] = await Promise.all([
        supabase
          .from("messages")
          .select("id, case_id, content, role, created_at")
          .in("case_id", caseIds)
          .order("created_at", { ascending: false })
          .limit(200),
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

      // Messages (LARA chat) — hidden from client timeline

      // Timeline entries
      for (const e of (tlRes.data || []) as any[]) {
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
      for (const d of (docRes.data || []) as any[]) {
        const sigLabel = d.signature_status === "signed" ? " (assinado)" :
                         d.signature_status === "sent" ? " (aguardando assinatura)" : "";
        unified.push({
          id: `doc-${d.id}`,
          case_id: d.case_id,
          title: `${d.name}${sigLabel}`,
          description: `Categoria: ${d.category} · Status: ${d.status}`,
          type: d.signature_status && d.signature_status !== "none" ? "assinatura" : "documento",
          status: d.signature_status === "signed" ? "assinado" : d.status,
          event_date: d.created_at,
          case_type: caseTypeMap.get(d.case_id) || "",
        });
      }

      // Hearings
      for (const h of (hearRes.data || []) as any[]) {
        unified.push({
          id: `hear-${h.id}`,
          case_id: h.case_id,
          title: h.title,
          description: h.location ? `Local: ${h.location}` : "",
          type: "audiencia",
          status: h.status,
          event_date: h.date,
          case_type: caseTypeMap.get(h.case_id) || "",
        });
      }

      // Intimações
      for (const i of (intRes.data || []) as any[]) {
        unified.push({
          id: `int-${i.id}`,
          case_id: i.case_id || "",
          title: i.raw_email_subject || "Intimação",
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
            title: c.label,
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

  // Fetch case options for the form
  const { data: caseOptions = [] } = useQuery({
    queryKey: ["case-options-for-timeline", caseIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_type")
        .in("id", caseIds);
      return data || [];
    },
    enabled: caseIds.length > 0,
  });

  const addEventMutation = useMutation({
    mutationFn: async (payload: {
      case_id: string;
      title: string;
      description: string;
      type: string;
      status: string;
    }) => {
      const { error } = await supabase.from("case_timeline").insert({
        case_id: payload.case_id,
        title: payload.title,
        description: payload.description,
        type: payload.type,
        status: payload.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-unified-timeline", caseIds] });
      setShowAddForm(false);
      toast.success("Movimentação registrada!");
    },
    onError: () => toast.error("Erro ao registrar movimentação"),
  });

  // Filter by active tab
  const currentTab = TIMELINE_TABS.find(t => t.value === activeTab) || TIMELINE_TABS[0];
  const filteredEvents = currentTab.types
    ? events.filter(e => (currentTab.types as readonly string[]).includes(e.type))
    : events;
  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  };

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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="w-4 h-4" />
          Timeline ({filteredEvents.length})
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1 h-7"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="w-3 h-3" />
          Nova movimentação
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-3">
        <TabsList className="h-8 w-full grid grid-cols-4">
          {TIMELINE_TABS.map((tab) => {
            const count = tab.types
              ? events.filter(e => (tab.types as readonly string[]).includes(e.type)).length
              : events.length;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-[11px] px-2 py-1 data-[state=active]:font-semibold">
                {tab.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <AddManualEventDialog
        open={showAddForm}
        onOpenChange={setShowAddForm}
        caseOptions={caseOptions}
        onSubmit={(data) => addEventMutation.mutate(data)}
        isPending={addEventMutation.isPending}
      />

      {filteredEvents.length === 0 ? (
        <div className="border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
          Nenhuma movimentação nesta categoria.
        </div>
      ) : (
        <div className="border border-border rounded-lg p-4 max-h-[500px] overflow-y-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border" />

            <div className="space-y-0">
              {visibleEvents.map((event, idx) => {
                const Icon = TYPE_ICONS[event.type] || Clock;
                const isFirst = idx === 0;
                const iconColor = event.type === "mensagem"
                  ? "text-amber-500 border-amber-200 bg-amber-50"
                  : "text-muted-foreground border-border bg-background";

                return (
                  <div key={event.id} className="relative flex items-start gap-3 py-3">
                    {/* Circle icon */}
                    <div className={`relative z-10 flex items-center justify-center shrink-0 rounded-full border-2 ${iconColor} ${isFirst ? "w-10 h-10" : "w-9 h-9"}`}>
                      <Icon className={isFirst ? "w-4.5 h-4.5" : "w-4 h-4"} />
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {event.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {event.case_type && (
                            <Link
                              to={`/cases/${event.case_id}`}
                              className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {event.case_type}
                            </Link>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateFull(event.event_date)}
                          </span>
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {hasMore && (
            <div className="pt-3 text-center border-t border-border mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              >
                Carregar mais ({filteredEvents.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Manual Event Dialog ──

function AddManualEventDialog({
  open,
  onOpenChange,
  caseOptions,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseOptions: { id: string; case_type: string }[];
  onSubmit: (data: { case_id: string; title: string; description: string; type: string; status: string }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("manual");
  const [status, setStatus] = useState("atualização_recebida");
  const [caseId, setCaseId] = useState(caseOptions[0]?.id || "");

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Informe o título da movimentação.");
      return;
    }
    if (!caseId) {
      toast.error("Selecione o caso.");
      return;
    }
    onSubmit({ case_id: caseId, title: title.trim(), description: description.trim(), type, status });
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setTitle("");
      setDescription("");
      setType("manual");
      setStatus("atualização_recebida");
      setCaseId(caseOptions[0]?.id || "");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">Nova movimentação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {caseOptions.length > 1 && (
            <div className="space-y-1">
              <Label className="text-[11px]">Caso *</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o caso" />
                </SelectTrigger>
                <SelectContent>
                  {caseOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.case_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[11px]">Título *</Label>
            <Input
              className="h-8 text-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Protocolo de petição inicial"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Descrição</Label>
            <Textarea
              className="text-xs min-h-[60px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes opcionais..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full gap-2" onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Registrar movimentação
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
