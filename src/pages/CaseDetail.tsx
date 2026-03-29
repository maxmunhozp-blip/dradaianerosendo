import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useCase, useUpdateCase } from "@/hooks/use-cases";
import { useDocumentsByCase, useCreateDocument, useUploadDocument } from "@/hooks/use-documents";
import { useChecklistByCase, useCreateChecklistItem, useToggleChecklistItem, useDeleteChecklistItem } from "@/hooks/use-checklist";
import { useMessagesByCase } from "@/hooks/use-messages";
import { useLaraChat } from "@/hooks/use-lara-chat";
import { CaseStatusStepper } from "@/components/CaseStatusStepper";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentRow } from "@/components/DocumentRow";
import { ChecklistItemRow } from "@/components/ChecklistItemRow";
import { LaraChat } from "@/components/LaraChat";
import { EmptyState } from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeletons";
import { ArrowLeft, Upload, Plus, FileText, ClipboardList, FolderOpen, FileDown } from "lucide-react";
import { GenerateDocumentsModal } from "@/components/GenerateDocumentsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const statusSteps = ["documentacao", "montagem", "protocolo", "andamento", "encerrado"];

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: caseData, isLoading: caseLoading } = useCase(id!);
  const { data: documents = [] } = useDocumentsByCase(id!);
  const { data: checklist = [] } = useChecklistByCase(id!);
  const { data: dbMessages = [] } = useMessagesByCase(id!);

  const { messages: chatMessages, isLoading: chatLoading, sendMessage, loadHistory } = useLaraChat(id);

  const updateCase = useUpdateCase();
  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocument();
  const createChecklistItem = useCreateChecklistItem();
  const toggleChecklistItem = useToggleChecklistItem();
  const deleteChecklistItem = useDeleteChecklistItem();

  const [newItem, setNewItem] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showDocGen, setShowDocGen] = useState(false);

  useEffect(() => {
    if (dbMessages.length > 0 && !historyLoaded) {
      loadHistory(dbMessages);
      setHistoryLoaded(true);
    }
  }, [dbMessages, historyLoaded, loadHistory]);

  if (caseLoading) return <DetailSkeleton />;

  if (!caseData) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FolderOpen}
          title="Caso não encontrado"
          description="Este caso pode ter sido removido ou o link está incorreto."
        />
      </div>
    );
  }

  const clientName = (caseData as any).clients?.name || "Cliente";

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateCase.mutateAsync({ id: id!, status: newStatus });
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fileUrl = await uploadDoc.mutateAsync({ file, caseId: id! });
      await createDoc.mutateAsync({
        case_id: id!,
        name: file.name,
        file_url: fileUrl,
        category: "outro",
        status: "recebido",
        uploaded_by: "advogada",
      });
      toast.success("Documento enviado com sucesso");
    } catch {
      toast.error("Erro ao enviar documento");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddChecklistItem = async () => {
    if (!newItem.trim()) return;
    try {
      await createChecklistItem.mutateAsync({ case_id: id!, label: newItem.trim() });
      setNewItem("");
      toast.success("Item adicionado");
    } catch {
      toast.error("Erro ao adicionar item");
    }
  };

  const handleToggleChecklist = async (itemId: string) => {
    const item = checklist.find((i) => i.id === itemId);
    if (!item) return;
    try {
      await toggleChecklistItem.mutateAsync({ id: itemId, done: !item.done, case_id: id! });
    } catch {
      toast.error("Erro ao atualizar item");
    }
  };

  const handleDeleteChecklist = async (itemId: string) => {
    try {
      await deleteChecklistItem.mutateAsync({ id: itemId, case_id: id! });
      toast.success("Item removido");
    } catch {
      toast.error("Erro ao remover item");
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left column */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0" style={{ flex: "0 0 60%" }}>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to={`/clients/${caseData.client_id}`}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            {clientName}
          </Link>
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{caseData.case_type}</h1>
              <StatusBadge status={caseData.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{caseData.description}</p>
            {caseData.cnj_number && (
              <p className="text-xs text-muted-foreground mt-1">CNJ: {caseData.cnj_number}</p>
            )}
            {caseData.court && (
              <p className="text-xs text-muted-foreground">Vara: {caseData.court}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDocGen(true)}>
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              Gerar documentos
            </Button>
            <Select value={caseData.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusSteps.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "documentacao" ? "Documentação" : s === "montagem" ? "Montagem" : s === "protocolo" ? "Protocolo" : s === "andamento" ? "Em andamento" : "Encerrado"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <GenerateDocumentsModal
          open={showDocGen}
          onOpenChange={setShowDocGen}
          caseId={id!}
          caseType={caseData.case_type}
          clientName={clientName}
          clientCpf={(caseData as any).clients?.cpf || null}
          clientEmail={(caseData as any).clients?.email || null}
        />

        <div className="mb-8 border border-border rounded-lg p-4">
          <CaseStatusStepper currentStatus={caseData.status} />
        </div>

        {/* Documents */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Documentos ({documents.length})</h2>
            <div>
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadDoc.isPending}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {uploadDoc.isPending ? "Enviando..." : "Upload"}
              </Button>
            </div>
          </div>
          <div className="border border-border rounded-lg px-4">
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhum documento"
                description="Envie o primeiro documento para este caso."
                actionLabel="Enviar documento"
                onAction={() => fileInputRef.current?.click()}
              />
            ) : (
              documents.map((doc) => <DocumentRow key={doc.id} doc={doc} />)
            )}
          </div>
        </div>

        {/* Checklist */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">
            Checklist ({checklist.filter((i) => i.done).length}/{checklist.length})
          </h2>
          <div className="border border-border rounded-lg px-4">
            {checklist.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title="Checklist vazio"
                description="Adicione itens ao checklist deste caso."
              />
            )}
            {checklist.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                onToggle={handleToggleChecklist}
                onDelete={handleDeleteChecklist}
              />
            ))}
            <div className="flex items-center gap-2 py-3">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
                placeholder="Adicionar item..."
                className="text-sm h-8"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleAddChecklistItem}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right column - LARA chat */}
      <div className="border-l border-border" style={{ flex: "0 0 40%" }}>
        <LaraChat
          messages={chatMessages}
          onSend={sendMessage}
          isLoading={chatLoading}
        />
      </div>
    </div>
  );
}
