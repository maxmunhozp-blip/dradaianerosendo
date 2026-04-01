import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, ClipboardList, ExternalLink, FileText, Bell, ScanSearch, CheckCircle2, XCircle, Download, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LaraAction {
  type: "send_whatsapp" | "create_task" | "open_client" | "generate_document" | "schedule_reminder" | "scan_documents" | "download_document" | "send_for_signature";
  label: string;
  data: Record<string, any>;
}

const ACTION_ICONS: Record<string, typeof MessageSquare> = {
  send_whatsapp: MessageSquare,
  create_task: ClipboardList,
  open_client: ExternalLink,
  generate_document: FileText,
  schedule_reminder: Bell,
  scan_documents: ScanSearch,
  download_document: Download,
  send_for_signature: PenLine,
};

const ACTION_DESCRIPTIONS: Record<string, (data: Record<string, any>) => string> = {
  send_whatsapp: (d) => `Enviar mensagem via WhatsApp para ${d.phone || "o cliente"}`,
  create_task: (d) => `Criar tarefa: "${d.title || ""}"`,
  open_client: () => `Abrir cadastro do cliente`,
  generate_document: () => `Abrir gerador de documentos para este caso`,
  schedule_reminder: (d) => `Agendar lembrete: "${d.title || ""}" para ${d.date || "data a definir"}`,
  scan_documents: () => `Escanear documentos pendentes com IA para extrair dados automaticamente`,
  download_document: (d) => `Baixar documento "${d.template || ""}" em ${d.format || "DOCX"}`,
};

interface ScanResult {
  name: string;
  status: "pending" | "processing" | "done" | "failed";
}

export function LaraActionButtons({ actions, onScanComplete }: { actions: LaraAction[]; onScanComplete?: (summary: string) => void }) {
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<LaraAction | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState<Set<number>>(new Set());

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);

  const handleScan = async (action: LaraAction) => {
    const { case_id, client_id } = action.data;
    if (!case_id) { toast.error("Caso não identificado"); return; }

    setScanning(true);
    setScanResults([]);
    setScanProgress(0);

    try {
      // Fetch pending documents
      const { data: docs, error } = await supabase
        .from("documents")
        .select("id, name, file_url, extraction_status")
        .eq("case_id", case_id)
        .neq("extraction_status", "done");

      const pendingDocs = (docs || []).filter((d: any) => d.file_url);

      if (pendingDocs.length === 0) {
        toast.info("Todos os documentos já foram escaneados");
        setScanning(false);
        return;
      }

      setScanTotal(pendingDocs.length);
      const results: ScanResult[] = pendingDocs.map((d: any) => ({ name: d.name, status: "pending" as const }));
      setScanResults([...results]);

      let successCount = 0;
      const extractedFields: string[] = [];

      for (let i = 0; i < pendingDocs.length; i++) {
        const doc = pendingDocs[i];
        results[i].status = "processing";
        setScanResults([...results]);
        setScanProgress(i);

        try {
          // 30s timeout per document
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          const { data, error: fnError } = await supabase.functions.invoke("process-document", {
            body: {
              document_id: doc.id,
              case_id,
              client_id,
              file_url: doc.file_url,
              file_name: doc.name,
            },
          });

          clearTimeout(timeout);

          if (fnError) throw fnError;

          results[i].status = "done";
          successCount++;

          // Collect extracted fields
          if (data?.extracted_data) {
            const fields = Object.entries(data.extracted_data)
              .filter(([, v]) => v)
              .map(([k]) => k);
            if (fields.length > 0) {
              extractedFields.push(`${doc.name}: ${fields.join(", ")}`);
            }
          }
        } catch {
          results[i].status = "failed";
        }

        setScanResults([...results]);
        setScanProgress(i + 1);
      }

      toast.success(`Escaneamento concluído! ${successCount}/${pendingDocs.length} documentos processados.`);

      // Auto-send summary to LARA
      if (onScanComplete) {
        const summary = extractedFields.length > 0
          ? `Escaneamento concluído. Dados encontrados:\n${extractedFields.join("\n")}\n\nResuma o que foi extraído e sugira próximos passos.`
          : `Escaneamento concluído. ${successCount} documentos processados mas nenhum dado relevante foi extraído. Verifique a qualidade dos documentos.`;
        onScanComplete(summary);
      }
    } catch (e: any) {
      toast.error("Erro ao escanear: " + (e.message || "erro desconhecido"));
    } finally {
      setScanning(false);
      const idx = actions.indexOf(action);
      setExecuted((prev) => new Set(prev).add(idx));
      setConfirmAction(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "scan_documents") {
      await handleScan(confirmAction);
      return;
    }

    setExecuting(true);

    try {
      switch (confirmAction.type) {
        case "send_whatsapp":
          await supabase.functions.invoke("whatsapp", {
            body: { phone: confirmAction.data.phone, message: confirmAction.data.message },
          });
          toast.success("Mensagem enviada via WhatsApp!");
          break;

        case "create_task":
          if (confirmAction.data.case_id) {
            await (supabase.from("checklist_items") as any).insert({
              case_id: confirmAction.data.case_id,
              label: confirmAction.data.title,
              required_by: confirmAction.data.due_date || null,
            });
          }
          toast.success("Tarefa criada!");
          break;

        case "open_client":
          navigate(`/clients/${confirmAction.data.client_id}`);
          break;

        case "generate_document":
          navigate(`/templates`);
          toast.info("Selecione o caso e tipo de documento na página de templates");
          break;

        case "download_document":
          navigate(`/templates`);
          break;

        case "schedule_reminder":
          if (confirmAction.data.case_id) {
            await (supabase.from("hearings") as any).insert({
              case_id: confirmAction.data.case_id,
              title: confirmAction.data.title,
              date: confirmAction.data.date || new Date().toISOString(),
              status: "agendado",
            });
          }
          toast.success("Lembrete agendado!");
          break;
      }

      const idx = actions.indexOf(confirmAction);
      setExecuted((prev) => new Set(prev).add(idx));
    } catch (e: any) {
      toast.error("Erro ao executar: " + (e.message || "erro desconhecido"));
    } finally {
      setExecuting(false);
      setConfirmAction(null);
    }
  };

  if (actions.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action, i) => {
          const Icon = ACTION_ICONS[action.type] || ClipboardList;
          const isDone = executed.has(i);
          return (
            <button
              key={i}
              onClick={() => !isDone && !scanning && setConfirmAction(action)}
              disabled={isDone || scanning}
              className="flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-semibold transition-colors"
              style={{
                border: "1.5px solid var(--wizard-primary, #1E3A5F)",
                color: isDone ? "#9CA3AF" : "var(--wizard-primary, #1E3A5F)",
                background: isDone ? "#F3F4F6" : "transparent",
                cursor: isDone || scanning ? "default" : "pointer",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {isDone ? "✓ " : ""}{action.label}
            </button>
          );
        })}
      </div>

      {/* Scan progress panel */}
      {scanning && scanResults.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ScanSearch className="w-3.5 h-3.5 animate-pulse" />
            Escaneando documento {Math.min(scanProgress + 1, scanTotal)} de {scanTotal}...
          </div>
          <Progress value={(scanProgress / scanTotal) * 100} className="h-1.5" />
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {scanResults.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                {r.status === "done" && <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />}
                {r.status === "failed" && <XCircle className="w-3 h-3 text-destructive shrink-0" />}
                {r.status === "processing" && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                {r.status === "pending" && <span className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" />}
                <span className={r.status === "done" ? "text-foreground" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                  {r.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan completed results */}
      {!scanning && scanResults.length > 0 && executed.size > 0 && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            Escaneamento concluído — {scanResults.filter(r => r.status === "done").length}/{scanResults.length} processados
          </div>
          <div className="space-y-0.5">
            {scanResults.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                {r.status === "done" ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-destructive" />}
                <span className={r.status === "done" ? "text-foreground" : "text-destructive"}>{r.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!confirmAction && !scanning} onOpenChange={() => !scanning && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar ação</DialogTitle>
            <DialogDescription>
              {confirmAction && (ACTION_DESCRIPTIONS[confirmAction.type]?.(confirmAction.data) || confirmAction.label)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={executing}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={executing}>
              {executing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
