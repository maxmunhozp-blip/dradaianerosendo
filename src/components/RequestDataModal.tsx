
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Send, Copy, Check, Loader2 } from "lucide-react";
import WhatsAppButton from "@/components/ui/WhatsAppButton";

interface RequestDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  clientId: string;
  clientData: Record<string, unknown>;
  caseData: Record<string, unknown>;
}

const FIELD_MAP: { key: string; label: string; category: "info"; check: (c: Record<string, unknown>, cs: Record<string, unknown>) => boolean }[] = [
  { key: "address", label: "Endereço completo", category: "info", check: (c) => !c.address_street },
  { key: "rg", label: "RG", category: "info", check: (c) => !c.rg },
  { key: "marital_status", label: "Estado civil", category: "info", check: (c) => !c.marital_status },
  { key: "profession", label: "Profissão", category: "info", check: (c) => !c.profession },
  { key: "nationality", label: "Nacionalidade", category: "info", check: (c) => !c.nationality || c.nationality === "brasileiro(a)" },
  { key: "children", label: "Nome e data de nascimento dos filhos", category: "info", check: (_, cs) => !cs.children || (Array.isArray(cs.children) && (cs.children as unknown[]).length === 0) },
  { key: "opposing_party", label: "Dados da parte contrária", category: "info", check: (_, cs) => !cs.opposing_party_name },
];

const DOCUMENT_CATALOG: { key: string; label: string }[] = [
  { key: "doc_rg", label: "RG (documento de identidade)" },
  { key: "doc_cpf", label: "CPF" },
  { key: "doc_certidao_nascimento", label: "Certidão de nascimento" },
  { key: "doc_certidao_casamento", label: "Certidão de casamento ou divórcio" },
  { key: "doc_comprovante_renda", label: "Comprovante de renda (holerite/contracheque)" },
  { key: "doc_declaracao_ir", label: "Declaração de Imposto de Renda" },
  { key: "doc_comprovante_residencia", label: "Comprovante de residência" },
  { key: "doc_ctps", label: "Carteira de Trabalho (CTPS)" },
  { key: "doc_matricula_imovel", label: "Certidão de matrícula do imóvel" },
  { key: "doc_escritura", label: "Escritura do imóvel" },
  { key: "doc_extrato_bancario", label: "Extrato bancário" },
  { key: "doc_cnh", label: "CNH (Carteira de Habilitação)" },
  { key: "doc_certidao_obito", label: "Certidão de óbito" },
  { key: "doc_pacto_antenupcial", label: "Pacto antenupcial" },
  { key: "doc_contrato_trabalho", label: "Contrato de trabalho" },
];

export function RequestDataModal({ open, onOpenChange, caseId, clientId, clientData, caseData }: RequestDataModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const detectedMissing = FIELD_MAP
    .filter((f) => f.check(clientData, caseData))
    .map((f) => f.key);

  useEffect(() => {
    if (open) {
      setSelected(new Set(detectedMissing));
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
    if (selected.size === 0) { toast.error("Selecione ao menos um item"); return; }
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar dados ao cliente</DialogTitle>
          <DialogDescription>
            Selecione o que precisa solicitar ao cliente. Um link seguro será gerado para preenchimento pelo celular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Informações do cadastro
            </p>
            <div className="space-y-1.5">
              {FIELD_MAP.map((f) => {
                const isMissing = detectedMissing.includes(f.key);
                return (
                  <div key={f.key} className="flex items-center gap-2">
                    <Checkbox
                      id={f.key}
                      checked={selected.has(f.key)}
                      onCheckedChange={() => toggleField(f.key)}
                    />
                    <Label htmlFor={f.key} className="text-sm cursor-pointer flex items-center gap-1.5">
                      {f.label}
                      {isMissing && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          faltando
                        </span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
            {detectedMissing.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">Todos os dados cadastrais estão preenchidos.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Documentos
            </p>
            <div className="space-y-1.5">
              {DOCUMENT_CATALOG.map((doc) => (
                <div key={doc.key} className="flex items-center gap-2">
                  <Checkbox
                    id={doc.key}
                    checked={selected.has(doc.key)}
                    onCheckedChange={() => toggleField(doc.key)}
                  />
                  <Label htmlFor={doc.key} className="text-sm cursor-pointer">
                    {doc.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Selecione o que precisa solicitar ao cliente.
          </p>

          {!generatedUrl ? (
            <Button onClick={handleGenerate} disabled={loading || selected.size === 0} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Gerar link de solicitação
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Prévia da mensagem:</p>
                <p className="text-sm whitespace-pre-line">{whatsappMessage}</p>
              </div>
              <div className="flex gap-2">
                <WhatsAppButton
                  phone={phone}
                  message={whatsappMessage}
                  onMissingPhone={() => toast.error("Cliente sem telefone cadastrado")}
                  className="flex-1"
                  disabled={!phone}
                >
                  <div className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/80 disabled:pointer-events-none disabled:opacity-50">
                    <Send className="w-4 h-4 mr-2" />
                    Enviar por WhatsApp
                  </div>
                </WhatsAppButton>
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              {!phone && <p className="text-xs text-destructive">Cliente sem telefone cadastrado</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
