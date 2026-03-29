import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, FileText, Image, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import type { ChatAttachment } from "@/lib/lara-stream";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  isStreaming?: boolean;
}

export function LaraChat({
  messages,
  onSend,
  isLoading = false,
  className,
  pendingCommand,
  onCommandConsumed,
}: {
  messages: ChatMessage[];
  onSend: (content: string, attachments: ChatAttachment[]) => void;
  isLoading?: boolean;
  className?: string;
  pendingCommand?: string | null;
  onCommandConsumed?: () => void;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
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
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: isImage ? "image" : "pdf",
            data,
            preview: isImage ? data : undefined,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-success" />
        <span className="text-sm font-medium text-foreground">LARA</span>
        <span className="text-xs text-muted-foreground">Assistente Jurídica IA</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Inicie uma conversa com a LARA.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Comandos: /procuracao · /contrato · /peticao · /checklist · /analise
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {/* Attachment chips */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded bg-background/20 px-2 py-0.5 text-[11px]"
                    >
                      {att.type === "image" ? (
                        <Image className="w-3 h-3" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      <span className="truncate max-w-[120px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-headings:text-secondary-foreground prose-p:text-secondary-foreground prose-li:text-secondary-foreground prose-strong:text-secondary-foreground prose-code:text-secondary-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
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

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="border-t border-border px-3 py-2 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 text-xs"
            >
              {att.type === "image" ? (
                att.preview ? (
                  <img src={att.preview} alt="" className="w-6 h-6 rounded object-cover" />
                ) : (
                  <Image className="w-3.5 h-3.5" />
                )
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span className="truncate max-w-[100px]">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="ml-1 hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte algo à LARA ou use um comando como /procuracao..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
