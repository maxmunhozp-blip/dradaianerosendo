import { useState, useEffect } from "react";
import { Copy, Check, MessageCircle, Send, ExternalLink, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ClientAccessCardProps {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  portalToken?: string;
  onSolicitarDados: () => void;
  onTokenCreated?: (token: string) => void;
}

export function ClientAccessCard({
  clientId,
  clientName,
  clientPhone,
  portalToken: initialToken,
  onSolicitarDados,
  onTokenCreated,
}: ClientAccessCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [renewing, setRenewing] = useState(false);

  // Sync prop changes
  useEffect(() => { setToken(initialToken); }, [initialToken]);

  // Auto-generate token when expanded and no token exists
  useEffect(() => {
    if (!expanded || token || generating) return;

    const generate = async () => {
      setGenerating(true);
      try {
        // Check for existing valid session first
        const { data: existing } = await supabase
          .from("client_sessions")
          .select("token, expires_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing && new Date(existing.expires_at) > new Date()) {
          setToken(existing.token);
          setExpiresAt(existing.expires_at);
          onTokenCreated?.(existing.token);
        } else {
          const { data: newSession, error } = await supabase
            .from("client_sessions")
            .insert({ client_id: clientId })
            .select("token")
            .single();
          if (error) throw error;
          setToken(newSession.token);
          onTokenCreated?.(newSession.token);
          toast.success("Link do portal gerado!");
        }
      } catch {
        toast.error("Erro ao gerar link do portal");
      } finally {
        setGenerating(false);
      }
    };

    generate();
  }, [expanded, token, clientId]);

  const publishedOrigin = "https://dradaianerosendo.lovable.app";
  const portalUrl = token
    ? `${publishedOrigin}/portal?token=${token}`
    : null;

  const firstName = clientName.split(" ")[0];

  const handleCopy = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!portalUrl) return;
    const phone = (clientPhone || "").replace(/\D/g, "");
    const number = phone.startsWith("55") ? phone : "55" + phone;
    const msg = `Olá ${firstName}! Acesse sua área do cliente pelo link abaixo para acompanhar seu processo:\n\n${portalUrl}`;
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="border border-border rounded-lg bg-background mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Acesso do cliente
          </span>
          {token ? (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Portal ativo
            </span>
          ) : (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              Sem acesso
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
          {generating ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Gerando link do portal...</span>
            </div>
          ) : portalUrl ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                Link do portal
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-md px-3 py-2 min-w-0">
                  <p className="text-xs text-muted-foreground truncate font-mono">
                    {portalUrl}
                  </p>
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </button>
                {clientPhone && (
                  <button
                    onClick={handleWhatsApp}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-muted/50 border border-dashed border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Erro ao gerar link. Tente fechar e abrir novamente.
              </p>
            </div>
          )}

          <div className="border-t border-border" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                Dados faltantes
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Envie um link para o cliente preencher endereço, filhos e dados da outra parte.
              </p>
            </div>
            <button
              onClick={onSolicitarDados}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Solicitar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
