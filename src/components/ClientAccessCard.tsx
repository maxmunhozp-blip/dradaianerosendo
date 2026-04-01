import { useState } from "react";
import { Copy, Check, MessageCircle, Send, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface ClientAccessCardProps {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  portalToken?: string;
  onSolicitarDados: () => void;
}

export function ClientAccessCard({
  clientId,
  clientName,
  clientPhone,
  portalToken,
  onSolicitarDados,
}: ClientAccessCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const portalUrl = portalToken
    ? `${window.location.origin}/portal?token=${portalToken}`
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
      {/* Header colapsável */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Acesso do cliente
          </span>
          {portalToken && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Portal ativo
            </span>
          )}
          {!portalToken && (
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
          {/* Link do portal */}
          {portalUrl ? (
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
                Este cliente ainda não tem link de acesso ao portal.
              </p>
            </div>
          )}

          {/* Divisor */}
          <div className="border-t border-border" />

          {/* Solicitar dados faltantes */}
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
