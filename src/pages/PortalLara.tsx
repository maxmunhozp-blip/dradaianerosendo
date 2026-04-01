import { useState, useRef, useEffect } from "react";
import { usePortalSession } from "@/components/ClientPortalLayout";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, Loader2 } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "Como está meu processo?",
  "Tenho documentos pendentes?",
  "Quando é minha próxima audiência?",
  "Qual o prazo estimado?",
];

export default function PortalLara() {
  const session = usePortalSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: caseData } = useQuery({
    queryKey: ["portal-lara-case", session?.clientId],
    queryFn: async () => {
      const { data } = await pub.from("cases").select("case_type").eq("client_id", session!.clientId).limit(1).maybeSingle();
      return data;
    },
    enabled: !!session?.clientId,
  });

  const firstName = session?.clientName?.split(" ")[0] || "";
  const caseType = caseData?.case_type || "seu processo";

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0 && firstName) {
      setMessages([{
        role: "assistant",
        content: `Olá ${firstName}! Sou a LARA, assistente da Dra. Daiane. Posso ajudar com dúvidas sobre seu processo de ${caseType}. O que gostaria de saber?`,
      }]);
    }
  }, [firstName, caseType]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setShowSuggestions(false);
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/lara-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          client_id: session?.clientId,
          portal: true,
        }),
      });

      if (!res.ok) throw new Error("Erro");
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || data.content || "Desculpe, não consegui processar. Tente novamente." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente em instantes." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 72px)", maxWidth: 440, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 10 }}>
        <MessageCircle size={22} color="var(--wizard-accent)" />
        <span style={{ fontFamily: "var(--wizard-font-display)", fontSize: 17, fontWeight: 600, color: "var(--wizard-primary)" }}>
          LARA — Assistente do Escritório
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 12,
          }}>
            <div style={{
              maxWidth: "85%", padding: "12px 16px", borderRadius: 16,
              background: msg.role === "user" ? "var(--wizard-primary)" : "#fff",
              color: msg.role === "user" ? "#fff" : "var(--wizard-primary)",
              fontSize: 14, lineHeight: 1.5, boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              borderBottomRightRadius: msg.role === "user" ? 4 : 16,
              borderBottomLeftRadius: msg.role === "assistant" ? 4 : 16,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
            <div style={{ background: "#fff", padding: "12px 16px", borderRadius: 16, borderBottomLeftRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <Loader2 size={18} className="animate-spin" color="var(--wizard-accent)" />
            </div>
          </div>
        )}

        {/* Suggestion chips */}
        {showSuggestions && messages.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                style={{
                  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20,
                  padding: "8px 14px", fontSize: 13, color: "var(--wizard-primary)",
                  cursor: "pointer", fontFamily: "var(--wizard-font-body)", fontWeight: 500,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 12px", borderTop: "1px solid #E5E7EB", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva sua dúvida..."
            rows={1}
            style={{
              flex: 1, resize: "none", border: "1.5px solid #E5E7EB", borderRadius: 12,
              padding: "12px 14px", fontSize: 15, fontFamily: "var(--wizard-font-body)",
              outline: "none", minHeight: 44, maxHeight: 120, lineHeight: 1.4,
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: input.trim() ? "var(--wizard-accent)" : "#E5E7EB",
              border: "none", cursor: input.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .2s", flexShrink: 0,
            }}
          >
            <Send size={18} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}
