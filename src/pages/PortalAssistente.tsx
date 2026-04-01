import { useState, useEffect, useCallback } from "react";
import { usePortalSession } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import LaraChat from "@/components/LaraChat";
import type { ChatMessage } from "@/components/LaraChat";
import type { ChatAttachment } from "@/lib/lara-stream";
import { Loader2 } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

const CHAT_URL = `${supabaseUrl}/functions/v1/lara-chat`;

export default function PortalAssistente() {
  const session = usePortalSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch the client's first active case
  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["portal-assistente-case", session?.clientId],
    queryFn: async () => {
      const { data } = await pub
        .from("cases")
        .select("id, case_type")
        .eq("client_id", session!.clientId)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!session?.clientId,
  });

  const caseId = caseData?.id;

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0 && session?.clientName) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content:
            "Olá! Sou a LARA, assistente do escritório da Dra. Daiane Rosendo. Posso responder dúvidas sobre seu processo. Como posso ajudar?",
        },
      ]);
    }
  }, [session?.clientName]);

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

        if (!resp.body) {
          throw new Error("Sem resposta");
        }

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

  if (caseLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 128px)" }}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 128px)" }}>
      <LaraChat
        messages={messages}
        onSend={sendMessage}
        isLoading={isLoading}
        className="h-full"
        caseId={caseId}
        clientId={session?.clientId}
      />
    </div>
  );
}
