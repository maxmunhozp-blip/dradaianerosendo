import { useState } from "react";
import { PenLine, Clock, CheckCircle2, XCircle, Loader2, Copy, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

interface Signer {
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

interface SignerResult {
  name: string;
  email: string;
  token: string;
  sign_url: string;
  phone: string;
}

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  clientName?: string;
  clientEmail?: string;
  clientCpf?: string;
  clientPhone?: string;
}

/** Normalize phone to digits only, ensuring country code */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Validate Brazilian phone: 55 + 2-digit DDD + 8-9 digit number */
function isValidBrPhone(raw: string): boolean {
  const digits = normalizePhone(raw);
  return /^55\d{10,11}$/.test(digits);
}

/** Format phone for display: (XX) XXXXX-XXXX */
function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Handle with or without country code
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw;
}

export function SignatureModal({
  open,
  onOpenChange,
  documentId,
  documentName,
  clientName = "",
  clientEmail = "",
  clientCpf = "",
  clientPhone = "",
}: SignatureModalProps) {
  const [signers, setSigners] = useState<Signer[]>([
    { name: clientName, email: clientEmail, cpf: clientCpf, phone: clientPhone },
  ]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SignerResult[] | null>(null);
  const [phoneErrors, setPhoneErrors] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  const updateSigner = (index: number, field: keyof Signer, value: string) => {
    setSigners((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
    // Clear phone error on edit
    if (field === "phone") {
      setPhoneErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const addSigner = () => {
    setSigners((prev) => [...prev, { name: "", email: "", cpf: "", phone: "" }]);
  };

  const removeSigner = (index: number) => {
    if (signers.length <= 1) return;
    setSigners((prev) => prev.filter((_, i) => i !== index));
    setPhoneErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const validatePhones = (): boolean => {
    const errors: Record<number, string> = {};
    signers.forEach((s, i) => {
      if (s.phone.trim() && !isValidBrPhone(s.phone)) {
        errors[i] = "Telefone inválido. Use: (XX) XXXXX-XXXX";
      }
    });
    setPhoneErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSend = async () => {
    const valid = signers.every((s) => s.name.trim() && s.email.trim());
    if (!valid) {
      toast.error("Preencha nome e e-mail de todos os signatários.");
      return;
    }

    if (!validatePhones()) {
      toast.error("Corrija os telefones inválidos antes de enviar.");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-for-signature", {
        body: { document_id: documentId, signers: signers.map(({ phone, ...rest }) => rest) },
      });

      if (error) {
        let errorMessage = "Erro ao enviar para assinatura.";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) errorMessage = body.error;
          else errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = error.message || errorMessage;
        }
        throw new Error(errorMessage);
      }
      if (data?.error) {
        console.error("Function returned error:", data.error);
        throw new Error(data.error);
      }
      if (!data?.signers?.length) {
        console.error("No signers returned:", data);
        throw new Error("Nenhum link de assinatura foi gerado. Verifique o token ZapSign nas Configurações.");
      }

      const signerResults: SignerResult[] = data.signers.map((s: any, i: number) => ({
        name: s.name || "",
        email: s.email || "",
        token: s.token || "",
        sign_url: s.sign_url || s.signing_link || "",
        phone: signers[i]?.phone || clientPhone || "",
      }));

      setResults(signerResults);

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents", undefined] });
      queryClient.invalidateQueries({ queryKey: ["signature-docs-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["documents-count-signed"] });

      toast.success("Links de assinatura gerados com sucesso!");
    } catch (err: any) {
      console.error("Signature send error:", err);
      toast.error(err.message || "Erro ao enviar para assinatura. Verifique as configurações do ZapSign.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setResults(null);
      setSigners([{ name: clientName, email: clientEmail, cpf: clientCpf, phone: clientPhone }]);
      setPhoneErrors({});
    }
    onOpenChange(v);
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            {results ? "Links gerados" : "Enviar para assinatura"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-md px-3 py-2">
            <p className="text-xs text-muted-foreground">Documento</p>
            <p className="text-sm font-medium truncate">{documentName}</p>
          </div>

          {!results ? (
            <>
              {signers.map((signer, index) => (
                <div key={index} className="space-y-2 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Signatário {index + 1}
                    </span>
                    {signers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeSigner(index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[11px]">Nome *</Label>
                      <Input
                        className="h-8 text-xs"
                        value={signer.name}
                        onChange={(e) => updateSigner(index, "name", e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">E-mail *</Label>
                      <Input
                        className="h-8 text-xs"
                        type="email"
                        value={signer.email}
                        onChange={(e) => updateSigner(index, "email", e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">CPF</Label>
                      <Input
                        className="h-8 text-xs"
                        value={signer.cpf}
                        onChange={(e) => updateSigner(index, "cpf", e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[11px]">Telefone (WhatsApp)</Label>
                      <Input
                        className={`h-8 text-xs ${phoneErrors[index] ? "border-destructive" : ""}`}
                        value={signer.phone}
                        onChange={(e) => updateSigner(index, "phone", e.target.value)}
                        placeholder="(11) 99999-9999"
                      />
                      {phoneErrors[index] && (
                        <p className="text-[10px] text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {phoneErrors[index]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1"
                onClick={addSigner}
              >
                <Plus className="w-3 h-3" />
                Adicionar signatário
              </Button>

              <Button
                className="w-full gap-2"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando link...
                  </>
                ) : (
                  <>
                    <PenLine className="w-4 h-4" />
                    Gerar link de assinatura
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              {results.map((signer, index) => {
                const hasPhone = signer.phone && isValidBrPhone(signer.phone);
                const whatsappPhone = hasPhone ? normalizePhone(signer.phone) : "";

                return (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div>
                      <p className="text-sm font-medium">{signer.name}</p>
                      <p className="text-xs text-muted-foreground">{signer.email}</p>
                      {signer.phone && (
                        <p className="text-xs text-muted-foreground">
                          📱 {formatPhoneDisplay(signer.phone)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 flex-1"
                        onClick={() => copyLink(signer.sign_url)}
                      >
                        <Copy className="w-3 h-3" />
                        Copiar link
                      </Button>
                      {hasPhone ? (
                        <WhatsAppButton
                          phone={whatsappPhone}
                          message={`Olá ${signer.name}! Segue o link para assinar o documento "${documentName}":\n\n${signer.sign_url}\n\nÉ só clicar no link, rolar até o final e assinar.`}
                          className="flex-1"
                        >
                          <Button variant="outline" size="sm" className="text-xs gap-1 w-full">
                            Enviar via WhatsApp
                          </Button>
                        </WhatsAppButton>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 flex-1 opacity-50"
                          disabled
                          title="Telefone não informado ou inválido"
                        >
                          WhatsApp indisponível
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleClose(false)}
              >
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Status badges for signature
export function SignatureStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-amber-300 text-amber-600 bg-amber-50">
          <Clock className="w-2.5 h-2.5" />
          Aguardando assinatura
        </Badge>
      );
    case "signed":
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-green-300 text-green-600 bg-green-50">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Assinado
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-destructive/30 text-destructive bg-destructive/5">
          <XCircle className="w-2.5 h-2.5" />
          Recusado
        </Badge>
      );
    default:
      return null;
  }
}
