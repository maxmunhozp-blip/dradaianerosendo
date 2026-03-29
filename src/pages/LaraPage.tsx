import { useState } from "react";
import { LaraChat } from "@/components/LaraChat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSendMessage } from "@/hooks/use-messages";
import type { Message } from "@/lib/types";

const shortcuts = [
  { cmd: "/procuracao", desc: "Gerar procuração" },
  { cmd: "/contrato", desc: "Gerar contrato de honorários" },
  { cmd: "/peticao", desc: "Redigir petição" },
  { cmd: "/checklist", desc: "Gerar checklist do caso" },
  { cmd: "/analise", desc: "Analisar documento" },
];

export default function LaraPage() {
  const [caseContext, setCaseContext] = useState<string>("none");
  const sendMessage = useSendMessage();

  const { data: allCases = [] } = useQuery({
    queryKey: ["cases-all-lara"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*, clients(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", caseContext],
    queryFn: async () => {
      if (caseContext === "none") return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("case_id", caseContext)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  const chatMessages: Message[] = messages.map((m: any) => ({
    id: m.id,
    created_at: m.created_at,
    case_id: m.case_id,
    role: m.role,
    content: m.content,
    attachments: m.attachments,
  }));

  const handleSend = async (content: string) => {
    if (caseContext === "none") return;
    await sendMessage.mutateAsync({ case_id: caseContext, role: "user", content });
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border">
          <span className="text-sm text-muted-foreground">Contexto:</span>
          <Select value={caseContext} onValueChange={setCaseContext}>
            <SelectTrigger className="w-64 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {allCases.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.case_type} — {c.clients?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1">
            {caseContext === "none" ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Selecione um caso para iniciar a conversa.</p>
              </div>
            ) : (
              <LaraChat messages={chatMessages} onSend={handleSend} />
            )}
          </div>

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
