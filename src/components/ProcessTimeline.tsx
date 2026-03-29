import { useState, useMemo } from "react";
import { useTimeline, useCreateTimelineEntry, useUpdateTimelineEntry, useDeleteTimelineEntry, type TimelineEntry } from "@/hooks/use-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { EmptyState } from "@/components/EmptyState";
import {
  Plus,
  Mail,
  Pencil,
  Pin,
  PinOff,
  Search,
  Filter,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ListFilter,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const TIMELINE_STATUSES = [
  { value: "atualização_recebida", label: "Atualização recebida", color: "bg-blue-100 text-blue-800" },
  { value: "em_andamento", label: "Em andamento", color: "bg-amber-100 text-amber-800" },
  { value: "aguardando", label: "Aguardando", color: "bg-orange-100 text-orange-800" },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-800" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-800" },
];

function getStatusStyle(status: string) {
  return TIMELINE_STATUSES.find((s) => s.value === status) || TIMELINE_STATUSES[0];
}

function getStatusLabel(status: string) {
  return getStatusStyle(status).label;
}

interface ProcessTimelineProps {
  caseId: string;
}

export function ProcessTimeline({ caseId }: ProcessTimelineProps) {
  const { data: entries = [], isLoading } = useTimeline(caseId);
  const createEntry = useCreateTimelineEntry();
  const updateEntry = useUpdateTimelineEntry();
  const deleteEntry = useDeleteTimelineEntry();

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "manual" | "automatic">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState("");
  const [formStatus, setFormStatus] = useState("em_andamento");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPinned, setFormPinned] = useState(false);

  const filtered = useMemo(() => {
    let result = entries;
    if (filterType !== "all") result = result.filter((e) => e.type === filterType);
    if (filterStatus !== "all") result = result.filter((e) => e.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.responsible?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, filterType, filterStatus, search]);

  const openNewModal = () => {
    setEditingEntry(null);
    setFormDate(new Date().toISOString().slice(0, 16));
    setFormStatus("em_andamento");
    setFormTitle("");
    setFormDescription("");
    setFormPinned(false);
    setShowModal(true);
  };

  const openEditModal = (entry: TimelineEntry) => {
    setEditingEntry(entry);
    setFormDate(new Date(entry.event_date).toISOString().slice(0, 16));
    setFormStatus(entry.status);
    setFormTitle(entry.title);
    setFormDescription(entry.description);
    setFormPinned(entry.pinned);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error("Informe um título");
      return;
    }
    try {
      if (editingEntry) {
        await updateEntry.mutateAsync({
          id: editingEntry.id,
          case_id: caseId,
          title: formTitle.trim(),
          description: formDescription.trim(),
          status: formStatus,
          event_date: new Date(formDate).toISOString(),
          pinned: formPinned,
        });
        toast.success("Movimentação atualizada");
      } else {
        await createEntry.mutateAsync({
          case_id: caseId,
          title: formTitle.trim(),
          description: formDescription.trim(),
          status: formStatus,
          event_date: new Date(formDate).toISOString(),
          type: "manual",
          pinned: formPinned,
        });
        toast.success("Movimentação adicionada");
      }
      setShowModal(false);
    } catch {
      toast.error("Erro ao salvar movimentação");
    }
  };

  const handleTogglePin = async (entry: TimelineEntry) => {
    try {
      await updateEntry.mutateAsync({ id: entry.id, case_id: caseId, pinned: !entry.pinned });
      toast.success(entry.pinned ? "Movimentação desafixada" : "Movimentação fixada");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const handleDelete = async (entry: TimelineEntry) => {
    try {
      await deleteEntry.mutateAsync({ id: entry.id, case_id: caseId });
      toast.success("Movimentação removida");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          Timeline do Processo ({entries.length})
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <ListFilter className="w-3.5 h-3.5 mr-1.5" />
            Filtros
          </Button>
          <Button size="sm" onClick={openNewModal}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova movimentação
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="h-8 text-xs pl-8"
                  placeholder="Buscar por palavra-chave..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="automatic">Automático</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {TIMELINE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Timeline entries */}
      <div className="border border-border rounded-lg">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nenhuma movimentação"
            description={entries.length > 0 ? "Nenhum resultado para os filtros selecionados." : "Registre a primeira movimentação deste processo."}
            actionLabel={entries.length === 0 ? "Nova movimentação" : undefined}
            onAction={entries.length === 0 ? openNewModal : undefined}
          />
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
            {filtered.map((entry, idx) => {
              const isAuto = entry.type === "automatic";
              const statusStyle = getStatusStyle(entry.status);
              const isUrgent = entry.status === "urgente";

              return (
                <div
                  key={entry.id}
                  className={`relative flex gap-4 px-4 py-4 ${
                    idx < filtered.length - 1 ? "border-b border-border" : ""
                  } ${entry.pinned ? "bg-amber-50/50" : ""} ${isUrgent ? "bg-red-50/30" : ""}`}
                >
                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isAuto
                          ? "bg-blue-100 border-blue-400"
                          : "bg-muted border-muted-foreground/30"
                      }`}
                    >
                      {isAuto ? (
                        <Mail className="w-2.5 h-2.5 text-blue-600" />
                      ) : entry.status === "concluido" ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                      ) : entry.status === "urgente" ? (
                        <AlertCircle className="w-2.5 h-2.5 text-red-600" />
                      ) : (
                        <FileText className="w-2.5 h-2.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.pinned && (
                            <Pin className="w-3 h-3 text-amber-500 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-foreground truncate">
                            {entry.title}
                          </span>
                          <Badge className={`${statusStyle.color} text-[10px] px-1.5 py-0 shrink-0`}>
                            {statusStyle.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 shrink-0 ${
                              isAuto ? "border-blue-300 text-blue-700" : ""
                            }`}
                          >
                            {isAuto ? "Automático" : "Manual"}
                          </Badge>
                        </div>
                        {entry.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                            {entry.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(entry.event_date), "dd/MM/yyyy HH:mm")}
                          </span>
                          {entry.responsible && (
                            <span>por {entry.responsible}</span>
                          )}
                          {entry.updated_at && entry.updated_at !== entry.created_at && (
                            <span className="italic">
                              editado {format(new Date(entry.updated_at), "dd/MM HH:mm")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={entry.pinned ? "Desafixar" : "Fixar"}
                          onClick={() => handleTogglePin(entry)}
                        >
                          {entry.pinned ? (
                            <PinOff className="w-3 h-3" />
                          ) : (
                            <Pin className="w-3 h-3" />
                          )}
                        </Button>
                        {entry.type === "manual" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Editar"
                            onClick={() => openEditModal(entry)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        <ConfirmDelete
                          title="Excluir movimentação"
                          description="Esta movimentação será removida permanentemente."
                          onConfirm={() => handleDelete(entry)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: New / Edit Movement */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Editar movimentação" : "Nova movimentação"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Data e hora</Label>
              <Input
                type="datetime-local"
                className="mt-1"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                className="mt-1"
                placeholder="Ex: Juntada de documentos"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Descrição detalhada</Label>
              <Textarea
                className="mt-1"
                rows={4}
                placeholder="Descreva a movimentação..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned-checkbox"
                checked={formPinned}
                onChange={(e) => setFormPinned(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="pinned-checkbox" className="text-xs cursor-pointer">
                Fixar como movimentação importante
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createEntry.isPending || updateEntry.isPending}
              >
                {(createEntry.isPending || updateEntry.isPending) && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                {editingEntry ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
