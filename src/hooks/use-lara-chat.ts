import { useState, useCallback } from "react";
import { streamLaraChat, type ChatAttachment } from "@/lib/lara-stream";
import { expandCommand } from "@/lib/lara-commands";
import type { ChatMessage } from "@/components/LaraChat";
import { toast } from "sonner";

export function useLaraChat(caseId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const sendMessage = useCallback(
    async (content: string, attachments: ChatAttachment[]) => {
      const { display, api } = expandCommand(content);

      // Show the display version in the chat bubble
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

      // Send the API version to the backend
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

  return { messages, isLoading, sendMessage, loadHistory };
}
