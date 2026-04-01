import { useState, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCase, useUpdateCase, useDeleteCase } from "@/hooks/use-cases";
import { useDocumentsByCase, useCreateDocument, useUploadDocument } from "@/hooks/use-documents";
import { useProcessDocument } from "@/hooks/use-extraction";
import { useChecklistByCase, useCreateChecklistItem, useToggleChecklistItem, useDeleteChecklistItem } from "@/hooks/use-checklist";
import { useMessagesByCase } from "@/hooks/use-messages";
import { useLaraChat } from "@/hooks/use-lara-chat";
import { CaseStatusStepper } from "@/components/CaseStatusStepper";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentRow } from "@/components/DocumentRow";
import { ChecklistItemRow } from "@/components/ChecklistItemRow";
import { LaraChat } from "@/components/LaraChat";
import { EmptyState } from "@/components/EmptyState";
import { ProcessTimeline } from "@/components/ProcessTimeline";
import { DetailSkeleton } from "@/components/Skeletons";
import { CaseTimeline } from "@/components/CaseTimeline";
import { ArrowLeft, Upload, Plus, FileText, ClipboardList, FolderOpen, FileDown, Scale, PanelRightClose, PanelRightOpen, CalendarDays, Clock, MapPin, MessageSquare, Pencil, Trash2, Send, PackageOpen, Loader2, Download } from "lucide-react";
import { useHearingsByCase } from "@/hooks/use-hearings";
import { HearingModal } from "@/components/HearingModal";
import { Badge } from "@/components/ui/badge";
import { format, differenceInHours, isBefore } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { GenerateDocumentsModal } from "@/components/GenerateDocumentsModal";
import { PeticaoModal } from "@/components/PeticaoModal";
import { RequestDataModal } from "@/components/RequestDataModal";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import JSZip from "jszip";
const statusSteps = ["documentacao", "montagem", "protocolo", "andamento", "encerrado"];

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: caseData, isLoading: caseLoading } = useCase(id!);
  const { data: documents = [] } = useDocumentsByCase(id!);
  const { data: checklist = [] } = useChecklistByCase(id!);
  const { data: dbMessages = [] } = useMessagesByCase(id!);

  const { messages: chatMessages, isLoading: chatLoading, sendMessage, loadHistory, auditContent, auditLoading, triggerAudit } = useLaraChat(id);

  const navigate = useNavigate();
  const updateCase = useUpdateCase();
  const deleteCase = useDeleteCase();
  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocument();
  const processDocument = useProcessDocument();
  const createChecklistItem = useCreateChecklistItem();
  const toggleChecklistItem = useToggleChecklistItem();
  const deleteChecklistItem = useDeleteChecklistItem();
  const [downloading, setDownloading] = useState(false);

  const [newItem, setNewItem] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showDocGen, setShowDocGen] = useState(false);
  const [showPeticao, setShowPeticao] = useState(false);
  const [showChat, setShowChat] = useState(() => {
    const saved = localStorage.getItem("lexai-lara-chat-visible");
    return saved !== null ? saved === "true" : true;
  });
  const [showHearingModal, setShowHearingModal] = useState(false);
  const { data: hearings = [] } = useHearingsByCase(id!);
  const [showRequestData, setShowRequestData] = useState(false);
  const [showEditCase, setShowEditCase] = useState(false);
  const [editCaseType, setEditCaseType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCnj, setEditCnj] = useState("");
  const [editCourt, setEditCourt] = useState("");

  useEffect(() => {
    if (dbMessages.length > 0 && !historyLoaded) {
      loadHistory(dbMessages);
      setHistoryLoaded(true);
    }
  }, [dbMessages, historyLoaded, loadHistory]);

  // Trigger audit when case loads
  useEffect(() => {
    if (caseData && id) {
      triggerAudit();
    }
  }, [caseData, id, triggerAudit]);

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

  const handleSaveCase = async () => {
    try {
      await updateCase.mutateAsync({
        id: id!,
        case_type: editCaseType,
        description: editDescription || null,
        cnj_number: editCnj || null,
        court: editCourt || null,
      });
      toast.success("Caso atualizado");
      setShowEditCase(false);
    } catch {
      toast.error("Erro ao atualizar caso");
    }
  };

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
      const doc = await createDoc.mutateAsync({
        case_id: id!,
        name: file.name,
        file_url: fileUrl,
        category: "outro",
        status: "recebido",
        uploaded_by: "advogada",
      });
      toast.success("Documento enviado com sucesso");

      // Trigger AI extraction in background
      if (caseData?.client_id) {
        processDocument.mutateAsync({
          documentId: doc.id,
          caseId: id!,
          clientId: caseData.client_id,
          fileUrl,
          fileName: file.name,
        }).then((result) => {
          if (result?.fields_found > 0) {
            toast.info(`IA extraiu ${result.fields_found} campo(s) do documento`, { duration: 5000 });
          }
        }).catch(() => {
          // Extraction failure is non-blocking
          console.warn("Document extraction failed");
        });
      }
    } catch {
      toast.error("Erro ao enviar documento");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getSignedUrl = async (url: string): Promise<string | null> => {
    const marker = "/object/public/case-documents/";
    const idx = url.indexOf(marker);
    if (idx === -1) return url;
    const path = url.substring(idx + marker.length);
    const { data, error } = await supabase.storage.from("case-documents").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const handleDownloadAll = async (asZip: boolean) => {
    const docsWithFiles = documents.filter((d) => d.file_url);
    if (docsWithFiles.length === 0) {
      toast.error("Nenhum documento com arquivo para baixar");
      return;
    }

    setDownloading(true);
    const toastId = toast.loading(`Preparando ${docsWithFiles.length} arquivo(s)...`);

    try {
      if (asZip) {
        const zip = new JSZip();
        const caseName = caseData?.case_type?.replace(/\s+/g, "_") || "caso";

        for (let i = 0; i < docsWithFiles.length; i++) {
          const doc = docsWithFiles[i];
          toast.loading(`Baixando ${i + 1}/${docsWithFiles.length}...`, { id: toastId });
          const url = await getSignedUrl(doc.file_url!);
          if (!url) continue;
          const res = await fetch(url);
          const blob = await res.blob();
          zip.file(doc.name, blob);
        }

        toast.loading("Gerando ZIP...", { id: toastId });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${caseName}_documentos.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        toast.success(`${docsWithFiles.length} documento(s) baixados em ZIP`, { id: toastId });
      } else {
        for (let i = 0; i < docsWithFiles.length; i++) {
          const doc = docsWithFiles[i];
          toast.loading(`Baixando ${i + 1}/${docsWithFiles.length}: ${doc.name}`, { id: toastId });
          const url = await getSignedUrl(doc.file_url!);
          if (!url) continue;
          const a = document.createElement("a");
          a.href = url;
          a.download = doc.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          await new Promise((r) => setTimeout(r, 500));
        }
        toast.success(`${docsWithFiles.length} documento(s) baixados`, { id: toastId });
      }
    } catch {
      toast.error("Erro ao baixar documentos", { id: toastId });
    } finally {
      setDownloading(false);
    }
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

  const handleDeleteCase = async () => {
    try {
      await deleteCase.mutateAsync(id!);
      toast.success("Caso excluído");
      navigate(`/clients/${caseData.client_id}`);
    } catch {
      toast.error("Erro ao excluir caso");
    }
  };

  return (
    <div className="relative flex h-[calc(100vh-3rem)]">
      {/* Left column */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0" style={{ flex: showChat ? "0 0 60%" : "1 1 100%" }}>
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
              <Select value={caseData.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-auto h-7 text-xs border-none p-0">
                  <StatusBadge status={caseData.status} />
                </SelectTrigger>
                <SelectContent>
                  {statusSteps.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "documentacao" ? "Documentação" : s === "montagem" ? "Montagem" : s === "protocolo" ? "Protocolo" : s === "andamento" ? "Em andamento" : "Encerrado"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Editar caso"
                onClick={() => {
                  setEditCaseType(caseData.case_type);
                  setEditDescription(caseData.description || "");
                  setEditCnj(caseData.cnj_number || "");
                  setEditCourt(caseData.court || "");
                  setShowEditCase(true);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir caso">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir caso</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este caso? Essa ação não pode ser desfeita. Todos os documentos, checklist e mensagens vinculados serão removidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
            <Button variant="outline" size="sm" onClick={() => setShowRequestData(true)}>
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Solicitar dados
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPeticao(true)}>
              <Scale className="w-3.5 h-3.5 mr-1.5" />
              Montar Petição
            </Button>
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

        <RequestDataModal
          open={showRequestData}
          onOpenChange={setShowRequestData}
          caseId={id!}
          clientId={caseData.client_id}
          clientData={(caseData as any).clients || {}}
          caseData={caseData as Record<string, unknown>}
        />

        <PeticaoModal
          open={showPeticao}
          onOpenChange={setShowPeticao}
          caseId={id!}
          caseData={caseData}
          clientData={(caseData as any).clients || {}}
          documents={documents}
          checklist={checklist}
        />

        {/* Edit Case Modal */}
        <Dialog open={showEditCase} onOpenChange={setShowEditCase}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Caso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo do caso</Label>
                <Input
                  value={editCaseType}
                  onChange={(e) => setEditCaseType(e.target.value)}
                  placeholder="Ex: Alimentos, Divórcio, Trabalhista..."
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descrição do caso"
                  rows={3}
                />
              </div>
              <div>
                <Label>Número CNJ</Label>
                <Input
                  value={editCnj}
                  onChange={(e) => setEditCnj(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                />
              </div>
              <div>
                <Label>Vara / Tribunal</Label>
                <Input
                  value={editCourt}
                  onChange={(e) => setEditCourt(e.target.value)}
                  placeholder="Ex: 1ª Vara de Família"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowEditCase(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCase} disabled={!editCaseType.trim() || updateCase.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mb-8 border border-border rounded-lg p-4">
          <CaseStatusStepper currentStatus={caseData.status} />
        </div>

        {/* Main Tabs: Movimentações + Gestão do Caso */}
        <Tabs defaultValue="movimentacoes" className="mb-8">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="movimentacoes" className="text-sm font-semibold">
              <Clock className="w-4 h-4 mr-1.5" />
              Movimentações
            </TabsTrigger>
            <TabsTrigger value="gestao" className="text-sm font-semibold">
              <FolderOpen className="w-4 h-4 mr-1.5" />
              Gestão do Caso
            </TabsTrigger>
          </TabsList>

          {/* Tab: Movimentações (Timeline) */}
          <TabsContent value="movimentacoes">
            <ProcessTimeline caseId={id!} />
          </TabsContent>

          {/* Tab: Gestão do Caso */}
          <TabsContent value="gestao" className="space-y-8">
            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground">Documentos ({documents.length})</h2>
                <div className="flex items-center gap-2">
                  {documents.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={downloading}>
                          {downloading ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Baixar todos
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownloadAll(true)} className="gap-2">
                          <PackageOpen className="w-4 h-4" />
                          Baixar como ZIP
                          <span className="text-xs text-muted-foreground ml-auto">Recomendado</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadAll(false)} className="gap-2">
                          <Download className="w-4 h-4" />
                          Baixar separados
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
                    actionLabel="Enviar documento"
                    onAction={() => fileInputRef.current?.click()}
                  />
                ) : (
                  documents.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc as any}
                      clientName={(caseData as any).clients?.name || ""}
                      clientEmail={(caseData as any).clients?.email || ""}
                      clientCpf={(caseData as any).clients?.cpf || ""}
                      clientPhone={(caseData as any).clients?.phone || ""}
                    />
                  ))
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

            {/* Hearings / Dates */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground">Datas ({hearings.length})</h2>
                <Button variant="outline" size="sm" onClick={() => setShowHearingModal(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar data
                </Button>
              </div>
              <div className="border border-border rounded-lg px-4">
                {hearings.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="Nenhuma data"
                    description="Adicione audiências e prazos para este caso."
                    actionLabel="Adicionar data"
                    onAction={() => setShowHearingModal(true)}
                  />
                ) : (
                  hearings.map((h) => {
                    const d = new Date(h.date);
                    const overdue = h.status === "agendado" && isBefore(d, new Date());
                    const hoursUntil = differenceInHours(d, new Date());
                    const isSoon = h.status === "agendado" && hoursUntil >= 0 && hoursUntil <= 48;
                    const statusColors: Record<string, string> = {
                      agendado: "bg-amber-100 text-amber-800",
                      realizado: "bg-green-100 text-green-800",
                      cancelado: "bg-muted text-muted-foreground",
                    };
                    return (
                      <div key={h.id} className={`flex items-center justify-between py-3 border-b border-border last:border-b-0 ${overdue ? "bg-destructive/5 -mx-4 px-4" : ""}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{h.title}</p>
                            {isSoon && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{hoursUntil <= 24 ? "Hoje" : "Amanhã"}</Badge>}
                            {overdue && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />{format(d, "dd/MM/yyyy HH:mm")}
                            </span>
                            {h.location && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />{h.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${statusColors[h.status]} text-[10px]`}>
                            {h.status === "agendado" ? "Agendado" : h.status === "realizado" ? "Realizado" : "Cancelado"}
                          </Badge>
                          {h.status === "agendado" && h.alert_whatsapp && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Enviar lembrete" onClick={() => {
                              const clientName = (caseData as any).clients?.name?.split(" ")[0] || "Cliente";
                              const phone = ((caseData as any).clients?.phone || "").replace(/\D/g, "");
                              const dateStr = format(d, "dd/MM/yyyy");
                              const timeStr = format(d, "HH:mm");
                              const loc = h.location || "local a confirmar";
                              if (!phone) { toast.error("Cliente sem telefone cadastrado"); return; }
                              supabase.functions.invoke("whatsapp", {
                                body: { phone, message: `Olá ${clientName}! Lembrando que sua audiência está marcada para ${dateStr} às ${timeStr}h em ${loc}. Qualquer dúvida estou à disposição. Dra. Daiane Rosendo.` },
                              }).then(({ error }) => { if (error) toast.error("Erro ao enviar"); else toast.success("Lembrete enviado"); });
                            }}>
                              <MessageSquare className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <HearingModal open={showHearingModal} onOpenChange={setShowHearingModal} defaultCaseId={id} />
            </div>

            {/* Activity Timeline */}
            <CaseTimeline
              documents={documents}
              messages={dbMessages}
              checklist={checklist}
              caseCreatedAt={caseData.created_at}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Toggle chat button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 z-10 h-8 w-8"
        onClick={() => setShowChat((prev) => { const next = !prev; localStorage.setItem("lexai-lara-chat-visible", String(next)); return next; })}
        title={showChat ? "Fechar LARA" : "Abrir LARA"}
      >
        {showChat ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
      </Button>

      {/* Right column - LARA chat */}
      {showChat && (
        <div className="border-l border-border" style={{ flex: "0 0 40%" }}>
          <LaraChat
            messages={chatMessages}
            onSend={sendMessage}
            isLoading={chatLoading}
            clientId={(caseData as any)?.client_id}
            caseId={id}
            auditContent={auditContent}
            auditLoading={auditLoading}
          />
        </div>
      )}
    </div>
  );
}
