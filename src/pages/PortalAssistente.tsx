import { useState, useEffect, useCallback } from "react";
import { usePortalSession } from "@/components/ClientPortalLayout";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { LaraChat } from "@/components/LaraChat";
import type { ChatMessage } from "@/components/LaraChat";
import type { ChatAttachment } from "@/lib/lara-stream";
import { Loader2, Scale, ChevronRight } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

const CHAT_URL = `${supabaseUrl}/functions/v1/lara-chat`;

const STATUS_LABELS: Record<string, string> = {
  documentacao: "Documentação",
  em_andamento: "Em andamento",
  aguardando_audiencia: "Aguardando audiência",
  concluido: "Concluído",
};

export default function PortalAssistente() {
  const session = usePortalSession();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch ALL cases for the client
  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ["portal-assistente-cases", session?.clientId],
    queryFn: async () => {
      const { data } = await pub
        .from("cases")
        .select("id, case_type, status, created_at")
        .eq("client_id", session!.clientId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!session?.clientId,
  });

  // Auto-select if only 1 case
  useEffect(() => {
    if (cases && cases.length === 1 && !selectedCaseId) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  const caseId = selectedCaseId;

  // Initial greeting when case is selected
  useEffect(() => {
    if (messages.length === 0 && caseId && session?.clientName) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content:
            "Olá! Sou a LARA, assistente do escritório da Dra. Daiane Rosendo. Posso responder dúvidas sobre seu processo. Como posso ajudar?",
        },
      ]);
    }
  }, [caseId, session?.clientName]);

  const sendMessage = useCallback(
    async (content: string, attachments: ChatAttachment[]) => {
      if (!content.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const apiMessages = [
          ...messages
            .filter((m) => m.id !== "greeting")
            .map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: content.trim() },
        ];

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            caseId: caseId || null,
            isPortalMode: true,
          }),
        });

        if (!resp.ok) throw new Error("Erro na resposta");
        if (!resp.body) throw new Error("Sem resposta");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        const assistantId = `assistant-${Date.now()}`;
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });
          const lines = textBuffer.split("\n");
          textBuffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.id === assistantId) {
                    return prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: assistantContent }
                        : m
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: assistantId,
                      role: "assistant" as const,
                      content: assistantContent,
                      isStreaming: true,
                    },
                  ];
                });
              }
            } catch {}
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content:
              "Desculpe, ocorreu um erro. Tente novamente em instantes.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, caseId, isLoading]
  );

  if (casesLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 128px)" }}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No cases
  if (!cases || cases.length === 0) {
    return (
      <div className="flex items-center justify-center px-6" style={{ height: "calc(100vh - 128px)" }}>
        <div className="text-center">
          <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum processo encontrado. Entre em contato com o escritório.
          </p>
        </div>
      </div>
    );
  }

  // Multiple cases — show selection
  if (!selectedCaseId && cases.length > 1) {
    return (
      <div className="px-4 py-6" style={{ maxWidth: 440, margin: "0 auto" }}>
        <p className="text-base font-semibold text-foreground mb-1">
          Sobre qual processo você quer falar?
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Selecione para conversar com a LARA sobre ele.
        </p>
        <div className="space-y-3">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCaseId(c.id);
                setMessages([]);
              }}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-background hover:border-primary hover:shadow-sm transition-all text-left"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {c.case_type}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {STATUS_LABELS[c.status] || c.status}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 128px)" }}>
      {/* Back button when multiple cases */}
      {cases.length > 1 && (
        <button
          onClick={() => {
            setSelectedCaseId(null);
            setMessages([]);
          }}
          className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Trocar processo
        </button>
      )}
      <div style={{ height: cases.length > 1 ? "calc(100% - 32px)" : "100%" }}>
        <LaraChat
          messages={messages}
          onSend={sendMessage}
          isLoading={isLoading}
          className="h-full"
          caseId={caseId ?? undefined}
          clientId={session?.clientId}
        />
      </div>
    </div>
  );
}
