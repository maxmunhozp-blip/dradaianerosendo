import { useState, useCallback, useRef } from "react";
import { streamLaraChat, type ChatAttachment } from "@/lib/lara-stream";
import { expandCommand } from "@/lib/lara-commands";
import type { ChatMessage } from "@/components/LaraChat";
import { toast } from "sonner";

export function useLaraChat(caseId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [auditContent, setAuditContent] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const auditTriggered = useRef<string | null>(null);

  const loadHistory = useCallback((dbMessages: any[]) => {
    setMessages(
      dbMessages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        attachments: m.attachments || undefined,
      }))
    );
  }, []);

  const triggerAudit = useCallback(async () => {
    if (!caseId || auditTriggered.current === caseId) return;
    auditTriggered.current = caseId;
    setAuditLoading(true);
    setAuditContent(null);

    let content = "";
    await streamLaraChat({
      messages: [{ role: "user", content: "__CASE_AUDIT__" }],
      caseId,
      onDelta: (text) => {
        content += text;
        setAuditContent(content);
      },
      onDone: () => setAuditLoading(false),
      onError: () => {
        setAuditLoading(false);
        setAuditContent(null);
      },
    });
  }, [caseId]);

  const sendMessage = useCallback(
    async (content: string, attachments: ChatAttachment[], options?: { isPortalMode?: boolean }) => {
      const { display, api } = expandCommand(content);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: display,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      let assistantContent = "";
      const assistantId = `assistant-${Date.now()}`;

      const apiMessages = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments,
        })),
        {
          role: "user" as const,
          content: api,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      ];

      await streamLaraChat({
        messages: apiMessages,
        caseId,
        onDelta: (text) => {
          assistantContent += text;
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
                role: "assistant",
                content: assistantContent,
                isStreaming: true,
              },
            ];
          });
        },
        onDone: () => {
          setIsLoading(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m
            )
          );
        },
        onError: (error) => {
          setIsLoading(false);
          toast.error(error);
        },
      });
    },
    [messages, caseId]
  );

  return { messages, isLoading, sendMessage, loadHistory, auditContent, auditLoading, triggerAudit };
}
