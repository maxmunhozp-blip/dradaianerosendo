
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Send, Copy, Check, Loader2 } from "lucide-react";
import WhatsAppButton from "@/components/ui/WhatsAppButton";

interface FieldOption {
  key: string;
  label: string;
  missing: boolean;
}

interface RequestDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  clientId: string;
  clientData: Record<string, unknown>;
  caseData: Record<string, unknown>;
}

const FIELD_MAP: { key: string; label: string; check: (c: Record<string, unknown>, cs: Record<string, unknown>) => boolean }[] = [
  { key: "address", label: "Endereço completo", check: (c) => !c.address_street },
  { key: "rg", label: "RG", check: (c) => !c.rg },
  { key: "marital_status", label: "Estado civil", check: (c) => !c.marital_status },
  { key: "profession", label: "Profissão", check: (c) => !c.profession },
  { key: "nationality", label: "Nacionalidade", check: (c) => !c.nationality || c.nationality === "brasileiro(a)" },
  { key: "children", label: "Nome e data de nascimento dos filhos", check: (_, cs) => !cs.children || (Array.isArray(cs.children) && (cs.children as unknown[]).length === 0) },
  { key: "opposing_party", label: "Dados da parte contrária", check: (_, cs) => !cs.opposing_party_name },
];

export function RequestDataModal({ open, onOpenChange, caseId, clientId, clientData, caseData }: RequestDataModalProps) {
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      const detected = FIELD_MAP
        .filter((f) => f.check(clientData, caseData))
        .map((f) => ({ key: f.key, label: f.label, missing: true }));
      setFields(detected);
      setSelected(new Set(detected.map((f) => f.key)));
      setGeneratedUrl(null);
      setCopied(false);
    }
  }, [open, clientData, caseData]);

  const toggleField = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const clientName = (clientData.name as string) || "Cliente";
  const firstName = clientName.split(" ")[0];
  const phone = ((clientData.phone as string) || "").replace(/\D/g, "");

  const handleGenerate = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos um campo"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-data-request", {
        body: {
          case_id: caseId,
          client_id: clientId,
          fields_requested: Array.from(selected),
        },
      });
      if (error) throw error;
      setGeneratedUrl(data.public_url);
      toast.success("Link gerado com sucesso!");
    } catch (err: unknown) {
      toast.error("Erro ao gerar link");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const whatsappMessage = `Olá ${firstName}! Para dar continuidade ao seu processo, preciso de algumas informações. Clique no link abaixo para preencher com segurança (menos de 3 minutos):\n\n${generatedUrl || "[link]"}\n\nQualquer dúvida, estou à disposição! 🤝\nDra. Daiane Rosendo`;

  const handleWhatsApp = () => {
    if (!phone) { toast.error("Cliente sem telefone cadastrado"); return; }
    const url = whatsappLink(phone, whatsappMessage);
    window.open(url, "_blank");
  };

  const handleCopy = async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar dados ao cliente</DialogTitle>
          <DialogDescription>
            Um link mágico será enviado para {clientName} preencher os dados faltantes pelo celular.
          </DialogDescription>
        </DialogHeader>

        {fields.length === 0 ? (
          <div className="text-center py-6">
            <Check className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Todos os dados estão preenchidos! 🎉</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Os seguintes dados estão faltando:</p>
              <div className="space-y-2">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Checkbox
                      id={f.key}
                      checked={selected.has(f.key)}
                      onCheckedChange={() => toggleField(f.key)}
                    />
                    <Label htmlFor={f.key} className="text-sm cursor-pointer">{f.label}</Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Desmarque o que não precisa agora.</p>
            </div>

            {!generatedUrl ? (
              <Button onClick={handleGenerate} disabled={loading || selected.size === 0} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Gerar link
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Prévia da mensagem:</p>
                  <p className="text-sm whitespace-pre-line">{whatsappMessage}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleWhatsApp} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/80" disabled={!phone}>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar por WhatsApp
                  </Button>
                  <Button variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                {!phone && <p className="text-xs text-destructive">Cliente sem telefone cadastrado</p>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
