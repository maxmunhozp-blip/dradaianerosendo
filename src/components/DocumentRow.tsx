import { useState, useRef } from "react";
import { StatusBadge } from "./StatusBadge";
import {
  Download, MoreHorizontal, Scale, ChevronDown, ChevronRight,
  Bold, Italic, List, Paperclip, Save, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdateDocument, useUploadDocument } from "@/hooks/use-documents";
import { toast } from "sonner";

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
  };
}

export function DocumentRow({ doc }: DocumentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(doc.notes || "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const updateDoc = useUpdateDocument();
  const uploadDoc = useUploadDocument();

  const categoryLabels: Record<string, string> = {
    pessoal: "Pessoal",
    assinado: "Assinado",
    processo: "Processo",
    outro: "Outro",
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
        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={doc.status} />
          {doc.file_url && doc.file_url !== "" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <Download className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="pb-4 pl-6 pr-0 space-y-2">
          {/* Formatting toolbar */}
          <div className="flex items-center gap-1 border border-border rounded-t-md bg-muted/40 px-2 py-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Negrito"
              onClick={() => insertFormatting("**", "**")}
            >
              <Bold className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Itálico"
              onClick={() => insertFormatting("_", "_")}
            >
              <Italic className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Lista"
              onClick={() => insertFormatting("\n- ", "")}
            >
              <List className="w-3 h-3" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <input ref={fileRef} type="file" className="hidden" onChange={handleAttachment} />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Anexar arquivo"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="w-3 h-3" />
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 gap-1"
              disabled={saving || notes === (doc.notes || "")}
              onClick={handleSaveNotes}
            >
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
    </div>
  );
}
