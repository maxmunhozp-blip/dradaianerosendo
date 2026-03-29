import { useEffect, useState, useRef } from "react";
import { LaraChat } from "@/components/LaraChat";
import { useLaraChat } from "@/hooks/use-lara-chat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const shortcuts = [
  { cmd: "/procuracao", desc: "Gerar procuração" },
  { cmd: "/contrato", desc: "Gerar contrato de honorários" },
  { cmd: "/peticao", desc: "Redigir petição" },
  { cmd: "/checklist", desc: "Gerar checklist do caso" },
  { cmd: "/analise", desc: "Analisar documento" },
];

export default function LaraPage() {
  const [caseContext, setCaseContext] = useState<string>("none");
  const activeCaseId = caseContext !== "none" ? caseContext : undefined;
  const { messages, isLoading, sendMessage, loadHistory } = useLaraChat(activeCaseId);
  const [historyLoaded, setHistoryLoaded] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  const { data: allCases = [] } = useQuery({
    queryKey: ["cases-all-lara"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dbMessages = [] } = useQuery({
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
  });

  useEffect(() => {
    if (caseContext !== "none" && dbMessages.length > 0 && historyLoaded !== caseContext) {
      loadHistory(dbMessages);
      setHistoryLoaded(caseContext);
    }
    if (caseContext !== historyLoaded) {
      loadHistory([]);
      setHistoryLoaded(null);
    }
  }, [caseContext, dbMessages, historyLoaded, loadHistory]);

  const handleCommandClick = (cmd: string) => {
    setPendingCommand(cmd);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border shrink-0">
          <span className="text-sm text-muted-foreground">Contexto:</span>
          <Select value={caseContext} onValueChange={setCaseContext}>
            <SelectTrigger className="w-64 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum (geral)</SelectItem>
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
            <LaraChat
              messages={messages}
              onSend={sendMessage}
              isLoading={isLoading}
              pendingCommand={pendingCommand}
              onCommandConsumed={() => setPendingCommand(null)}
            />
          </div>

          <div className="w-56 border-l border-border p-4 hidden lg:block">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Comandos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shortcuts.map((s) => (
                <button
                  key={s.cmd}
                  onClick={() => handleCommandClick(s.cmd)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                  title={s.desc}
                >
                  <code className="font-mono font-medium">{s.cmd}</code>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
