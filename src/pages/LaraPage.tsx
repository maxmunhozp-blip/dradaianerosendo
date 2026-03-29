import { useState } from "react";
import { LaraChat } from "@/components/LaraChat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockCases, getClientById } from "@/lib/mock-data";
import type { Message } from "@/lib/types";

const shortcuts = [
  { cmd: "/procuracao", desc: "Gerar procuração" },
  { cmd: "/contrato", desc: "Gerar contrato de honorários" },
  { cmd: "/peticao", desc: "Redigir petição" },
  { cmd: "/checklist", desc: "Gerar checklist do caso" },
  { cmd: "/analise", desc: "Analisar documento" },
];

export default function LaraPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [caseContext, setCaseContext] = useState<string>("none");

  const handleSend = (content: string) => {
    const userMsg: Message = {
      id: `m-${Date.now()}`,
      created_at: new Date().toISOString(),
      case_id: caseContext !== "none" ? caseContext : "",
      role: "user",
      content,
      attachments: null,
    };
    const assistantMsg: Message = {
      id: `m-${Date.now() + 1}`,
      created_at: new Date().toISOString(),
      case_id: caseContext !== "none" ? caseContext : "",
      role: "assistant",
      content: "Estou analisando sua solicitação. Em um momento terei a resposta pronta para você.",
      attachments: null,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">Contexto:</span>
          <Select value={caseContext} onValueChange={setCaseContext}>
            <SelectTrigger className="w-64 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {mockCases.map((c) => {
                const client = getClientById(c.client_id);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_type} — {client?.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Chat */}
          <div className="flex-1">
            <LaraChat messages={messages} onSend={handleSend} />
          </div>

          {/* Shortcuts sidebar */}
          <div className="w-56 border-l border-border p-4 hidden lg:block">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Comandos
            </p>
            <div className="space-y-2">
              {shortcuts.map((s) => (
                <div key={s.cmd} className="text-sm">
                  <code className="text-xs font-mono text-foreground">{s.cmd}</code>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
