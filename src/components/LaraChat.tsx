import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, FileText, Image, X, Loader2, MessageSquare, CheckCircle2, Scale, Save, ClipboardList, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LaraActionButtons } from "@/components/LaraActionButtons";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ChatAttachment } from "@/lib/lara-stream";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  isStreaming?: boolean;
}

interface WhatsAppAction {
  phone: string;
  message: string;
  name: string;
}

interface WizardChoice {
  document: string;
  missing: string[];
}

interface SaveDataAction {
  fields?: Record<string, any>;
  case_fields?: Record<string, any>;
}

interface LaraAction {
  type: "send_whatsapp" | "create_task" | "open_client" | "generate_document" | "schedule_reminder";
  label: string;
  data: Record<string, any>;
}

function parseActionBlocks(content: string) {
  let cleanContent = content;
  let whatsappActions: WhatsAppAction[] = [];
  let wizardChoice: WizardChoice | null = null;
  let saveDataAction: SaveDataAction | null = null;
  let laraActions: LaraAction[] = [];

  // LARA structured actions (ACTIONS_START/END)
  cleanContent = cleanContent.replace(/ACTIONS_START\s*\n?([\s\S]*?)\n?ACTIONS_END/g, (_, json) => {
    try { const parsed = JSON.parse(json.trim()); if (Array.isArray(parsed)) laraActions = parsed; } catch {}
    return "";
  });

  // WhatsApp actions
  cleanContent = cleanContent.replace(/```whatsapp-action\s*\n([\s\S]*?)```/g, (_, json) => {
    try { const parsed = JSON.parse(json.trim()); if (Array.isArray(parsed)) whatsappActions = parsed; } catch {}
    return "";
  });

  // Wizard choice
  cleanContent = cleanContent.replace(/```wizard-choice\s*\n([\s\S]*?)```/g, (_, json) => {
    try { wizardChoice = JSON.parse(json.trim()); } catch {}
    return "";
  });

  // Save data action
  cleanContent = cleanContent.replace(/```save-data-action\s*\n([\s\S]*?)```/g, (_, json) => {
    try { saveDataAction = JSON.parse(json.trim()); } catch {}
    return "";
  });

  return { cleanContent: cleanContent.trim(), whatsappActions, wizardChoice, saveDataAction, laraActions };
}

function WhatsAppActionBlock({ actions }: { actions: WhatsAppAction[] }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [results, setResults] = useState<{ name: string; success: boolean }[]>([]);

  const handleSend = async () => {
    setSending(true);
    const sendResults: { name: string; success: boolean }[] = [];
    for (const action of actions) {
      try {
        const { error } = await supabase.functions.invoke("whatsapp", {
          body: { phone: action.phone, message: action.message },
        });
        sendResults.push({ name: action.name, success: !error });
      } catch { sendResults.push({ name: action.name, success: false }); }
    }
    setResults(sendResults);
    setSending(false);
    setSent(true);
    const successCount = sendResults.filter((r) => r.success).length;
    if (successCount === actions.length) toast.success(`Mensagens enviadas para ${successCount} cliente(s)!`);
    else toast.warning(`${successCount}/${actions.length} mensagens enviadas.`);
  };

  if (sent) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-accent" />Envio concluído
        </div>
        {results.map((r, i) => (
          <div key={i} className="text-[11px] text-muted-foreground">{r.success ? "✓" : "✗"} {r.name}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <MessageSquare className="w-3.5 h-3.5" />{actions.length} mensagem(ns) para enviar via WhatsApp
      </div>
      <div className="space-y-1 mb-3">
        {actions.map((a, i) => (
          <div key={i} className="text-[11px] text-muted-foreground">• {a.name} — {a.phone}</div>
        ))}
      </div>
      <Button size="sm" onClick={handleSend} disabled={sending} className="w-full">
        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        {sending ? "Enviando..." : "Confirmar envio"}
      </Button>
    </div>
  );
}

function WizardChoiceBlock({ choice, onSend }: { choice: WizardChoice; onSend: (msg: string) => void }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-3">
        <ClipboardList className="w-3.5 h-3.5" />
        {choice.missing.length} campo(s) faltando para {choice.document}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="default" onClick={() => onSend("Coletar dados agora")} className="flex-1">
          <ClipboardList className="w-3.5 h-3.5 mr-1" />Coletar dados agora
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSend("Gerar com placeholders")} className="flex-1">
          Gerar com [PREENCHER]
        </Button>
      </div>
    </div>
  );
}

function SaveDataBlock({ action, clientId, caseId }: { action: SaveDataAction; clientId?: string; caseId?: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!clientId) { toast.error("Nenhum cliente vinculado ao caso"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-client-data", {
        body: { clientId, caseId, fields: action.fields, case_fields: action.case_fields },
      });
      if (error) throw error;
      toast.success("Dados salvos no cadastro do cliente!");
      setSaved(true);
    } catch (e: any) {
      toast.error("Erro ao salvar dados: " + (e.message || "erro desconhecido"));
    } finally { setSaving(false); }
  };

  if (saved) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-accent" />Dados salvos no cadastro
        </div>
      </div>
    );
  }

  const fieldCount = Object.keys(action.fields || {}).length + Object.keys(action.case_fields || {}).length;

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-2 text-xs text-amber-800 mb-2">
        <Save className="w-3.5 h-3.5" />{fieldCount} campo(s) coletado(s) durante a conversa
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
        {saving ? "Salvando..." : "Salvar dados no cadastro do cliente"}
      </Button>
    </div>
  );
}

export function LaraChat({
  messages, onSend, isLoading = false, className, pendingCommand, onCommandConsumed,
  clientId, caseId, auditContent, auditLoading,
}: {
  messages: ChatMessage[];
  onSend: (content: string, attachments: ChatAttachment[]) => void;
  isLoading?: boolean;
  className?: string;
  pendingCommand?: string | null;
  onCommandConsumed?: () => void;
  clientId?: string;
  caseId?: string;
  auditContent?: string | null;
  auditLoading?: boolean;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [auditOpen, setAuditOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messages[messages.length - 1]?.content]);

  useEffect(() => {
    if (pendingCommand) {
      setInput((prev) => (prev ? `${prev} ${pendingCommand}` : pendingCommand));
      onCommandConsumed?.();
    }
  }, [pendingCommand, onCommandConsumed]);

  const handleSend = useCallback(() => {
    if (!input.trim() && attachments.length === 0) return;
    onSend(input.trim(), attachments);
    setInput("");
    setAttachments([]);
  }, [input, attachments, onSend]);

  const handleQuickSend = useCallback((text: string) => {
    onSend(text, []);
  }, [onSend]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        setAttachments((prev) => [...prev, { name: file.name, type: isImage ? "image" : "pdf", data, preview: isImage ? data : undefined }]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.role !== "assistant") {
      return <p className="whitespace-pre-wrap">{msg.content}</p>;
    }

    const { cleanContent, whatsappActions, wizardChoice, saveDataAction, laraActions } = parseActionBlocks(msg.content);
    const hasLexML = cleanContent.includes("[lexml-verified]");
    const displayContent = cleanContent.replace(/\[lexml-verified\]/g, "").trim();

    return (
      <>
        <div className="prose prose-sm max-w-none break-words overflow-hidden prose-headings:text-secondary-foreground prose-p:text-secondary-foreground prose-li:text-secondary-foreground prose-strong:text-secondary-foreground prose-code:text-secondary-foreground prose-a:text-amber-600 prose-a:break-all">
          <ReactMarkdown>{displayContent}</ReactMarkdown>
          {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />}
        </div>
        {hasLexML && !msg.isStreaming && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 w-fit">
            <Scale className="w-3 h-3" />Verificado via LexML
          </div>
        )}
        {laraActions.length > 0 && !msg.isStreaming && <LaraActionButtons actions={laraActions} />}
        {whatsappActions.length > 0 && !msg.isStreaming && <WhatsAppActionBlock actions={whatsappActions} />}
        {wizardChoice && !msg.isStreaming && <WizardChoiceBlock choice={wizardChoice} onSend={handleQuickSend} />}
        {saveDataAction && !msg.isStreaming && <SaveDataBlock action={saveDataAction} clientId={clientId} caseId={caseId} />}
      </>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-success" />
        <span className="text-sm font-medium text-foreground">LARA</span>
        <span className="text-xs text-muted-foreground">Estagiária Jurídica IA</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Audit card */}
        {(auditContent || auditLoading) && (
          <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
            <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Auditoria do caso
                    {auditLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  </span>
                  {auditOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 text-sm text-amber-900">
                  <div className="prose prose-sm max-w-none prose-headings:text-amber-900 prose-p:text-amber-800 prose-li:text-amber-800 prose-strong:text-amber-900">
                    <ReactMarkdown>{auditContent || ""}</ReactMarkdown>
                    {auditLoading && <span className="inline-block w-1.5 h-4 bg-amber-600 animate-pulse ml-0.5" />}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {messages.length === 0 && !auditContent && !auditLoading && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Inicie uma conversa com a LARA.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Comandos: /procuracao · /contrato · /peticao · /checklist · /analise · /cobrar · /lei
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm overflow-hidden break-words ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1 rounded bg-background/20 px-2 py-0.5 text-[11px]">
                      {att.type === "image" ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      <span className="truncate max-w-[120px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {renderMessageContent(msg)}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {attachments.length > 0 && (
        <div className="border-t border-border px-3 py-2 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 text-xs">
              {att.type === "image" ? (
                att.preview ? <img src={att.preview} alt="" className="w-6 h-6 rounded object-cover" /> : <Image className="w-3.5 h-3.5" />
              ) : <FileText className="w-3.5 h-3.5" />}
              <span className="truncate max-w-[100px]">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="ml-1 hover:text-foreground"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileSelect} className="hidden" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Pergunte algo à LARA ou use /cobrar para enviar lembretes..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
