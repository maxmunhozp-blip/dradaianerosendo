import { useState, useRef, useCallback, useEffect } from "react";
import { PdfViewer } from "./PdfViewer";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "./StatusBadge";
import {
  Download, Scale, ChevronDown, ChevronRight,
  Bold, Italic, List, Paperclip, Save, Loader2, Eye,
  CheckCircle2, AlertCircle, Trash2, PenLine, Mail, ExternalLink, MessageCircle,
} from "lucide-react";
import { SignatureModal, SignatureStatusBadge } from "@/components/SignatureModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useUpdateDocument, useUploadDocument, useDeleteDocument } from "@/hooks/use-documents";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DocumentRowProps {
  doc: {
    id: string;
    name: string;
    category: string;
    status: string;
    file_url: string | null;
    uploaded_by: string;
    notes: string | null;
    case_id: string;
    extraction_status?: string | null;
    extraction_confidence?: string | null;
    signature_status?: string | null;
    signature_doc_token?: string | null;
    signed_file_url?: string | null;
    signers?: any | null;
  };
  clientName?: string;
  clientEmail?: string;
  clientCpf?: string;
  clientPhone?: string;
}

const statusOptions = [
  { value: "solicitado", label: "Solicitado" },
  { value: "recebido", label: "Recebido" },
  { value: "assinado", label: "Assinado" },
  { value: "enviado", label: "Enviado" },
];

const categoryOptions = [
  { value: "pessoal", label: "Pessoal" },
  { value: "assinado", label: "Assinado" },
  { value: "processo", label: "Processo" },
  { value: "outro", label: "Outro" },
];

export function DocumentRow({ doc, clientName, clientEmail, clientCpf, clientPhone }: DocumentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(doc.notes || "");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(clientEmail || "");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<{ id: string; email: string; label: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const updateDoc = useUpdateDocument();
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const categoryLabels: Record<string, string> = {
    pessoal: "Pessoal",
    assinado: "Assinado",
    processo: "Processo",
    outro: "Outro",
  };

  // Fetch email accounts on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("email_accounts").select("id, email, label").in("status", ["active", "conectado"]);
      if (data && data.length > 0) {
        setEmailAccounts(data);
        setSelectedAccountId(data[0].id);
      }
    })();
  }, []);

  const openEmailDialog = () => {
    setEmailTo(clientEmail || "");
    setEmailSubject(`Documento: ${doc.name}`);
    setEmailBody(`Olá,\n\nSegue em anexo o documento "${doc.name}".\n\nAtenciosamente.`);
    setEmailCc("");
    setEmailBcc("");
    setShowCcBcc(false);
    setEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) { toast.error("Informe o destinatário"); return; }
    if (!doc.file_url) { toast.error("Documento sem arquivo"); return; }
    setSendingEmail(true);
    try {
      const signedUrl = await getSignedUrl(doc.file_url);
      if (!signedUrl) throw new Error("Erro ao gerar URL do arquivo");

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          account_id: selectedAccountId || undefined,
          to: emailTo.trim(),
          cc: emailCc.trim() || undefined,
          bcc: emailBcc.trim() || undefined,
          subject: emailSubject,
          body: emailBody + `\n\n📎 Documento: ${doc.name}\n${signedUrl}`,
        },
      });
      if (error) throw error;
      toast.success("E-mail enviado com sucesso!");
      setEmailOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar e-mail");
    } finally {
      setSendingEmail(false);
    }
  };

  const activeFileUrl = previewUrl || doc.signed_file_url || doc.file_url;
  const isPdf = previewMimeType
    ? previewMimeType.includes("pdf")
    : activeFileUrl?.toLowerCase().endsWith(".pdf") || activeFileUrl?.includes(".pdf");
  const isImage = previewMimeType
    ? previewMimeType.startsWith("image/")
    : /\.(jpg|jpeg|png|webp|gif)/i.test(activeFileUrl || "");
  const signersList = Array.isArray(doc.signers) ? doc.signers : [];
  const firstSigner = signersList[0] as any;
  const signerVerificationUrl =
    firstSigner?.sign_url ||
    firstSigner?.signing_link ||
    (firstSigner?.token ? `https://app.zapsign.com.br/verificar/${firstSigner.token}` : null);

  // Extract storage path from full public URL
  const getStoragePath = useCallback((url: string) => {
    const marker = "/object/public/case-documents/";
    const idx = url.indexOf(marker);
    if (idx !== -1) return url.substring(idx + marker.length);
    return null;
  }, []);

  const getSignedUrl = useCallback(async (url: string): Promise<string | null> => {
    const path = getStoragePath(url);
    if (!path) return url; // fallback to original
    const { data, error } = await supabase.storage
      .from("case-documents")
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }, [getStoragePath]);

  const cleanupPreviewUrl = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  const loadPreviewUrl = useCallback(async (url: string) => {
    cleanupPreviewUrl();
    const response = await fetch(url);
    if (!response.ok) throw new Error("Não foi possível carregar o documento.");
    const blob = await response.blob();
    setPreviewMimeType(blob.type || null);
    // Store raw ArrayBuffer for PDF viewer
    const arrayBuffer = await blob.arrayBuffer();
    setPdfData(arrayBuffer);
    // Also create object URL for image preview
    const objectUrl = URL.createObjectURL(blob);
    previewObjectUrlRef.current = objectUrl;
    return objectUrl;
  }, [cleanupPreviewUrl]);

  const handlePreviewOpen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUrl = doc.signed_file_url || doc.file_url;

    if (!targetUrl) {
      toast.error("Arquivo não disponível para visualização.");
      return;
    }

    setPreviewLoading(true);
    try {
      const resolvedPreviewUrl = await loadPreviewUrl(targetUrl);
      setPreviewUrl(resolvedPreviewUrl);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Erro ao abrir preview do documento:", error);
      toast.error("Não foi possível abrir o preview deste documento.");
    } finally {
      setPreviewLoading(false);
    }
  }, [doc.file_url, doc.signed_file_url, loadPreviewUrl]);

  useEffect(() => {
    if (!previewOpen) {
      cleanupPreviewUrl();
      setPreviewUrl(null);
      setPreviewMimeType(null);
      setPreviewLoading(false);
    }
  }, [cleanupPreviewUrl, previewOpen]);

  useEffect(() => () => cleanupPreviewUrl(), [cleanupPreviewUrl]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const targetUrl = doc.signed_file_url || doc.file_url;
    if (!targetUrl) return;
    try {
      const url = await getSignedUrl(targetUrl);
      if (!url) throw new Error("URL inválida");
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateDoc.mutateAsync({ id: doc.id, status: newStatus });
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleCategoryChange = async (newCategory: string) => {
    try {
      await updateDoc.mutateAsync({ id: doc.id, category: newCategory });
      toast.success("Categoria atualizada");
    } catch {
      toast.error("Erro ao atualizar categoria");
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await updateDoc.mutateAsync({ id: doc.id, notes });
      toast.success("Anotações salvas");
    } catch {
      toast.error("Erro ao salvar anotações");
    } finally {
      setSaving(false);
    }
  };

  const insertFormatting = (prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = notes.substring(start, end);
    const newText = notes.substring(0, start) + prefix + selected + suffix + notes.substring(end);
    setNotes(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadDoc.mutateAsync({ file, caseId: doc.case_id });
      const link = `\n📎 [${file.name}](${url})`;
      setNotes((prev) => prev + link);
      toast.success("Anexo adicionado às anotações");
    } catch {
      toast.error("Erro ao enviar anexo");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="border-b border-border last:border-0">
      {/* Header row */}
      <button
        className="flex items-center justify-between w-full py-3 text-left hover:bg-muted/30 transition-colors -mx-4 px-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
              {doc.category === "processo" && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 font-medium gap-1">
                  <Scale className="w-2.5 h-2.5" />
                  Petição Inicial
                </Badge>
              )}
              {doc.extraction_status === "processing" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-amber-300 text-amber-600 bg-amber-50">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Extraindo dados...
                </Badge>
              )}
              {doc.extraction_status === "done" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-green-300 text-green-600 bg-green-50">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {doc.extraction_confidence === "high" ? "Dados extraídos" : "Dados parciais"}
                </Badge>
              )}
              {doc.extraction_status === "failed" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-destructive/30 text-destructive bg-destructive/5">
                  <AlertCircle className="w-2.5 h-2.5" />
                  Extração falhou
                </Badge>
              )}
              {doc.signature_status && doc.signature_status !== "none" && (
                <SignatureStatusBadge status={doc.signature_status} />
              )}
              {doc.notes && doc.notes.trim() && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Com anotações
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{categoryLabels[doc.category] || doc.category}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {doc.uploaded_by === "advogada" ? "Advogada" : "Cliente"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Select value={doc.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-6 w-auto min-w-[90px] text-[11px] border-0 bg-transparent px-1.5 gap-1 focus:ring-0 [&>svg]:w-3 [&>svg]:h-3">
              <StatusBadge status={doc.status} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(doc.file_url && doc.file_url !== "" || doc.signed_file_url || (doc.signature_status === "signed" && doc.signature_doc_token)) && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Visualizar"
                onClick={handlePreviewOpen}
                disabled={previewLoading}
              >
                {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Baixar"
                onClick={handleDownload}
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
              {doc.signature_status === "signed" && signerVerificationUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-emerald-600"
                  title="Abrir assinatura no ZapSign"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(signerVerificationUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <Scale className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Enviar por e-mail"
                onClick={(e) => { e.stopPropagation(); openEmailDialog(); }}
              >
                <Mail className="w-3.5 h-3.5" />
              </Button>
              {doc.signature_status === "sent" && doc.signers && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600"
                  title="Enviar link de assinatura via WhatsApp"
                  onClick={(e) => {
                    e.stopPropagation();
                    const signUrl = firstSigner?.sign_url;
                    if (!signUrl) {
                      toast.error("Link de assinatura não disponível.");
                      return;
                    }
                    const phone = clientPhone?.replace(/\D/g, "") || "";
                    const msg = encodeURIComponent(
                      `Olá! Segue o link para assinatura do documento "${doc.name}":\n\n${signUrl}\n\nPor favor, assine o quanto antes. Obrigado!`
                    );
                    const waUrl = phone
                      ? `https://wa.me/55${phone}?text=${msg}`
                      : `https://wa.me/?text=${msg}`;
                    window.open(waUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          )}
          {doc.file_url && doc.file_url !== "" && (!doc.signature_status || doc.signature_status === "none") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Enviar para assinatura"
              onClick={(e) => { e.stopPropagation(); setSignatureOpen(true); }}
            >
              <PenLine className="w-3.5 h-3.5" />
            </Button>
          )}
          {doc.signature_status === "sent" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              title="Ver links de assinatura"
              onClick={(e) => { e.stopPropagation(); setSignatureOpen(true); }}
            >
              <PenLine className="w-3 h-3" />
              Ver link
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Excluir"
            onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="pb-4 pl-6 pr-0 space-y-3">
          {/* Inline status & category selectors */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Categoria:</span>
              <Select value={doc.category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Select value={doc.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-1 border border-border rounded-t-md bg-muted/40 px-2 py-1.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Negrito" onClick={() => insertFormatting("**", "**")}>
              <Bold className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Itálico" onClick={() => insertFormatting("_", "_")}>
              <Italic className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Lista" onClick={() => insertFormatting("\n- ", "")}>
              <List className="w-3 h-3" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <input ref={fileRef} type="file" className="hidden" onChange={handleAttachment} />
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Anexar arquivo" onClick={() => fileRef.current?.click()}>
              <Paperclip className="w-3 h-3" />
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1" disabled={saving || notes === (doc.notes || "")} onClick={handleSaveNotes}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar
            </Button>
          </div>

          {/* Notes textarea */}
          <textarea
            ref={textareaRef}
            className="w-full border border-t-0 border-border rounded-b-md p-3 text-sm min-h-[120px] resize-y bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono leading-relaxed"
            placeholder="Anotações sobre o andamento deste documento...&#10;&#10;Use **negrito**, _itálico_ e - listas para formatar."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Preview - PDF Viewer or Dialog */}
      {previewOpen && isPdf && pdfData ? (
        <PdfViewer
          data={pdfData}
          fileName={doc.name}
          onClose={() => setPreviewOpen(false)}
          onDownload={() => handleDownload({} as React.MouseEvent)}
        />
      ) : (
        <Dialog open={previewOpen && !isPdf} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-sm font-medium truncate pr-4">{doc.name}</DialogTitle>
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {isImage && previewUrl ? (
                <div className="w-full h-full flex items-center justify-center p-6 overflow-auto">
                  <img src={previewUrl} alt={doc.name} className="max-w-full max-h-full object-contain rounded" />
                </div>
              ) : previewUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground text-sm">
                  <p>Pré-visualização não disponível neste navegador.</p>
                  <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir em nova aba
                  </Button>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  <p>Pré-visualização não disponível para este tipo de arquivo.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento <strong>"{doc.name}"</strong> será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await deleteDoc.mutateAsync({ id: doc.id, caseId: doc.case_id, fileUrl: doc.file_url });
                  toast.success("Documento excluído");
                } catch {
                  toast.error("Erro ao excluir documento");
                }
              }}
            >
              {deleteDoc.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Signature Modal */}
      <SignatureModal
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        documentId={doc.id}
        documentName={doc.name}
        clientName={clientName}
        clientEmail={clientEmail}
        clientCpf={clientCpf}
        clientPhone={clientPhone}
      />
      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Enviar documento por e-mail
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {emailAccounts.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Enviar de</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.label} ({acc.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`email-to-${doc.id}`} className="text-xs">Para</Label>
              <Input id={`email-to-${doc.id}`} className="h-8 text-sm" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            {!showCcBcc && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowCcBcc(true)}>
                + Enviar cópia (CC/BCC)
              </button>
            )}
            {showCcBcc && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Cópia (CC) <span className="text-[10px] text-muted-foreground">— todos verão</span>
                  </Label>
                  <Input className="h-8 text-sm" value={emailCc} onChange={e => setEmailCc(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Cópia oculta (BCC) <span className="text-[10px] text-muted-foreground">— ninguém vê</span>
                  </Label>
                  <Input className="h-8 text-sm" value={emailBcc} onChange={e => setEmailBcc(e.target.value)} placeholder="email@exemplo.com" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Assunto</Label>
              <Input className="h-8 text-sm" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea className="text-sm min-h-[80px] resize-y" value={emailBody} onChange={e => setEmailBody(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{doc.name}</span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEmailOpen(false)}>Cancelar</Button>
              <Button size="sm" className="gap-1.5" onClick={handleSendEmail} disabled={sendingEmail || !emailTo.trim()}>
                {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
