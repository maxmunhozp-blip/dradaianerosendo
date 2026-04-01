import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { usePortalSession } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useLaraChat } from "@/hooks/use-lara-chat";
import ReactMarkdown from "react-markdown";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

const CHIPS = [
  "Como está meu processo?",
  "Preciso enviar algum documento?",
  "Quando terei novidades?",
  "Quero falar com o escritório",
];

export default function PortalAssistente() {
  const session = usePortalSession();
  const [input, setInput] = useState("");
  const [chipsVisible, setChipsVisible] = useState(true);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [officePhone, setOfficePhone] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, sendMessage } = useLaraChat(caseId ?? undefined);

  const clientName = session?.clientName?.split(" ")[0] || "";

  // Load case + office phone
  useEffect(() => {
    if (!session?.clientId) return;
    const load = async () => {
      const { data: cases } = await pub
        .from("cases")
        .select("id")
        .eq("client_id", session.clientId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cases?.[0]) setCaseId(cases[0].id);

      const { data: settings } = await pub
        .from("settings")
        .select("value")
        .eq("key", "office_phone")
        .maybeSingle();
      if (settings?.value) setOfficePhone(settings.value);
    };
    load();
  }, [session?.clientId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Init message — hidden from UI
  useEffect(() => {
    if (caseId && messages.length === 0 && !isLoading) {
      sendMessage("__PORTAL_INIT__", [], { isPortalMode: true, clientId: session?.clientId });
    }
  }, [caseId]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !caseId) return;
    if (trimmed === "Quero falar com o escritório" && officePhone) {
      const phone = officePhone.replace(/\D/g, "");
      const number = phone.startsWith("55") ? phone : "55" + phone;
      window.open(
        `https://wa.me/${number}?text=${encodeURIComponent("Olá! Gostaria de falar sobre meu processo.")}`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    setChipsVisible(false);
    sendMessage(trimmed, [], { isPortalMode: true });
    setInput("");
  };

  const isFirstMessage = messages.length <= 1;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 72px)", maxWidth: 440, margin: "0 auto" }}>
      {/* Header Sofia */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-sm" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
            S
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
            Sofia
          </p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
            Assistente virtual · Escritório Rosendo
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-muted/30">
        {messages.length === 0 && isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xs font-bold">S</span>
            </div>
            <div className="bg-background rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-muted-foreground/40"
                    style={{ animation: `bounce 1s ${i * 0.15}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-xs font-bold">S</span>
              </div>
            )}
            <div
              className={`max-w-[85%] px-4 py-3 shadow-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                  : "bg-background text-foreground rounded-2xl rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none text-foreground" style={{ fontFamily: "Nunito, system-ui, sans-serif", fontSize: 14, lineHeight: 1.6 }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p style={{ fontFamily: "Nunito, system-ui, sans-serif", fontSize: 14, lineHeight: 1.5 }}>
                  {msg.content}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Chips */}
        {chipsVisible && isFirstMessage && messages.length >= 1 && !isLoading && (
          <div className="grid grid-cols-1 gap-2 mt-2">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className="text-left px-4 py-3 rounded-xl border-2 border-border bg-background text-sm font-semibold text-foreground hover:border-primary hover:bg-accent active:scale-[0.98] transition-all"
                style={{ fontFamily: "Nunito, system-ui, sans-serif", minHeight: 52 }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Loading dots */}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xs font-bold">S</span>
            </div>
            <div className="bg-background rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-muted-foreground/40"
                    style={{ animation: `bounce 1s ${i * 0.15}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-background">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Digite sua dúvida..."
            rows={1}
            disabled={isLoading || !caseId}
            className="flex-1 resize-none bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
            style={{
              fontFamily: "Nunito, system-ui, sans-serif",
              minHeight: 52,
              maxHeight: 120,
            }}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading || !caseId}
            className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-primary-foreground" />
            )}
          </button>
        </div>

        {officePhone && (
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Precisa de atendimento urgente?{" "}
            <button
              onClick={() => {
                const p = officePhone.replace(/\D/g, "");
                const n = p.startsWith("55") ? p : "55" + p;
                window.open(`https://wa.me/${n}`, "_blank", "noopener,noreferrer");
              }}
              className="text-primary font-semibold underline underline-offset-2"
            >
              Fale direto no WhatsApp
            </button>
          </p>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
