import { useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useCreateDocument, useUploadDocument } from "@/hooks/use-documents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Save, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseType: string;
  clientName: string;
  clientCpf: string | null;
  clientEmail: string | null;
}

const fullDate = () => {
  const d = new Date();
  const months = [
    "janeiro","fevereiro","março","abril","maio","junho",
    "julho","agosto","setembro","outubro","novembro","dezembro",
  ];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
};

const caseTypePowers: Record<string, string> = {
  "Divórcio": "podendo requerer divórcio consensual ou litigioso, partilha de bens, alimentos e guarda de filhos",
  "Guarda": "podendo requerer guarda compartilhada ou unilateral, regulamentação de visitas e alimentos",
  "Alimentos": "podendo requerer fixação, revisão ou exoneração de alimentos",
  "Inventário": "podendo requerer abertura de inventário, partilha de bens e direitos sucessórios",
};

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 270) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function generateProcuracao(
  clientName: string,
  clientCpf: string,
  caseType: string,
  city: string,
  state: string,
  oab: string
): jsPDF {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const margin = 25;
  const maxW = pw - margin * 2;
  let y = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PROCURAÇÃO AD JUDICIA", pw / 2, y, { align: "center" });
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const outorgante = `${clientName}, brasileiro(a), a definir, portador(a) do CPF nº ${clientCpf}, residente e domiciliado(a) em _____________________________, pelo presente instrumento, nomeia e constitui sua bastante procuradora:`;
  y = addWrappedText(doc, outorgante, margin, y, maxW, 6);
  y += 6;

  const advogada = `DAIANE ROSENDO, inscrita na OAB/${state} sob o nº ${oab}, com escritório profissional localizado em [Endereço],`;
  doc.setFont("helvetica", "bold");
  y = addWrappedText(doc, advogada, margin, y, maxW, 6);
  y += 6;

  doc.setFont("helvetica", "normal");
  const powers = caseTypePowers[caseType] || "podendo praticar todos os atos necessários ao bom andamento do processo";
  const poderes = `à qual confere amplos poderes para o foro em geral, com a cláusula "ad judicia et extra", em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as medidas judiciais e extrajudiciais cabíveis, ${powers}, podendo ainda substabelecer esta em outrem, com ou sem reservas de poderes.`;
  y = addWrappedText(doc, poderes, margin, y, maxW, 6);
  y += 16;

  doc.text(`${city}, ${fullDate()}.`, margin, y);
  y += 30;

  doc.line(margin, y, margin + 80, y);
  y += 6;
  doc.text(clientName, margin, y);
  y += 6;
  doc.text(`CPF: ${clientCpf}`, margin, y);

  return doc;
}

function generateContrato(
  clientName: string,
  clientCpf: string,
  caseType: string,
  city: string,
  state: string,
  oab: string,
  honorarios: string,
  paymentTerms: string
): jsPDF {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const margin = 25;
  const maxW = pw - margin * 2;
  let y = 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  y = addWrappedText(doc, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS", margin, y, maxW, 7);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const contratante = `CONTRATANTE: ${clientName}, CPF nº ${clientCpf}, doravante denominado(a) simplesmente CONTRATANTE.`;
  y = addWrappedText(doc, contratante, margin, y, maxW, 6);
  y += 4;

  const contratada = `CONTRATADA: DAIANE ROSENDO, inscrita na OAB/${state} sob o nº ${oab}, doravante denominada simplesmente CONTRATADA.`;
  y = addWrappedText(doc, contratada, margin, y, maxW, 6);
  y += 6;

  y = addWrappedText(doc, "As partes acima identificadas têm entre si justo e acertado o presente Contrato de Prestação de Serviços Advocatícios, que se regerá pelas cláusulas seguintes:", margin, y, maxW, 6);
  y += 8;

  // Clausula 1
  doc.setFont("helvetica", "bold");
  y = addWrappedText(doc, "CLÁUSULA PRIMEIRA — DO OBJETO", margin, y, maxW, 6);
  doc.setFont("helvetica", "normal");
  y += 2;
  y = addWrappedText(doc, `A CONTRATADA compromete-se a prestar serviços advocatícios à CONTRATANTE referentes a: ${caseType}.`, margin, y, maxW, 6);
  y += 8;

  // Clausula 2
  doc.setFont("helvetica", "bold");
  y = addWrappedText(doc, "CLÁUSULA SEGUNDA — DOS HONORÁRIOS", margin, y, maxW, 6);
  doc.setFont("helvetica", "normal");
  y += 2;
  y = addWrappedText(doc, `Pelos serviços ora contratados, a CONTRATANTE pagará à CONTRATADA a título de honorários advocatícios o valor de R$ ${honorarios}, nas seguintes condições: ${paymentTerms}.`, margin, y, maxW, 6);
  y += 8;

  // Clausula 3
  doc.setFont("helvetica", "bold");
  y = addWrappedText(doc, "CLÁUSULA TERCEIRA — DAS OBRIGAÇÕES DA CONTRATANTE", margin, y, maxW, 6);
  doc.setFont("helvetica", "normal");
  y += 2;
  y = addWrappedText(doc, "A CONTRATANTE obriga-se a fornecer todos os documentos necessários para a execução dos serviços, bem como manter a CONTRATADA informada sobre qualquer fato relevante relacionado ao objeto deste contrato.", margin, y, maxW, 6);
  y += 8;

  // Clausula 4
  doc.setFont("helvetica", "bold");
  y = addWrappedText(doc, "CLÁUSULA QUARTA — DO FORO", margin, y, maxW, 6);
  doc.setFont("helvetica", "normal");
  y += 2;
  y = addWrappedText(doc, `Fica eleito o foro da Comarca de ${city}, para dirimir quaisquer dúvidas oriundas do presente contrato.`, margin, y, maxW, 6);
  y += 14;

  doc.text(`${city}, ${fullDate()}.`, margin, y);
  y += 25;

  // Signatures
  const sigW = 65;
  doc.line(margin, y, margin + sigW, y);
  doc.line(pw - margin - sigW, y, pw - margin, y);
  y += 6;
  doc.setFontSize(10);

  const leftLines = doc.splitTextToSize(clientName, sigW);
  for (const l of leftLines) { doc.text(l, margin, y); y += 5; }
  doc.text("CONTRATANTE", margin, y);

  let yR = y - leftLines.length * 5;
  doc.text("DAIANE ROSENDO", pw - margin - sigW, yR);
  yR += 5;
  doc.text(`CONTRATADA — OAB/${state} ${oab}`, pw - margin - sigW, yR);

  return doc;
}

export function GenerateDocumentsModal({
  open,
  onOpenChange,
  caseId,
  caseType,
  clientName,
  clientCpf,
  clientEmail,
}: Props) {
  const [tab, setTab] = useState("procuracao");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [oab, setOab] = useState("");
  const [honorarios, setHonorarios] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("à vista, mediante recibo.");
  const [saving, setSaving] = useState(false);

  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocument();

  const cpf = clientCpf || "___.___.___-__";

  const buildPdf = () => {
    if (tab === "procuracao") {
      return generateProcuracao(clientName, cpf, caseType, city || "[Cidade]", state, oab || "[OAB]");
    }
    return generateContrato(clientName, cpf, caseType, city || "[Cidade]", state, oab || "[OAB]", honorarios || "[valor]", paymentTerms);
  };

  const fileName = tab === "procuracao"
    ? `Procuracao_${clientName.replace(/\s/g, "_")}.pdf`
    : `Contrato_${clientName.replace(/\s/g, "_")}.pdf`;

  const handleDownload = () => {
    const doc = buildPdf();
    doc.save(fileName);
    toast.success("PDF gerado com sucesso!");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const doc = buildPdf();
      const blob = doc.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });
      const fileUrl = await uploadDoc.mutateAsync({ file, caseId });
      await createDoc.mutateAsync({
        case_id: caseId,
        name: tab === "procuracao" ? "Procuração Ad Judicia" : "Contrato de Honorários",
        file_url: fileUrl,
        category: "processo",
        status: "assinado",
        uploaded_by: "advogada",
      });
      toast.success("Documento salvo no caso!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar documento");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMessage = () => {
    const firstName = clientName.split(" ")[0];
    const msg = `Olá ${firstName}, segue o link para assinatura dos documentos: [cole o link de assinatura OAB aqui]`;
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Gerar documentos
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="procuracao" className="flex-1 text-xs">
              Procuração Ad Judicia
            </TabsTrigger>
            <TabsTrigger value="contrato" className="flex-1 text-xs">
              Contrato de Honorários
            </TabsTrigger>
          </TabsList>

          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Estado (UF)</Label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="SP"
                  className="h-8 text-sm"
                  maxLength={2}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nº OAB</Label>
              <Input
                value={oab}
                onChange={(e) => setOab(e.target.value)}
                placeholder="123.456"
                className="h-8 text-sm"
              />
            </div>

            <TabsContent value="contrato" className="mt-0 space-y-3">
              <div>
                <Label className="text-xs">Honorários (R$)</Label>
                <Input
                  value={honorarios}
                  onChange={(e) => setHonorarios(e.target.value)}
                  placeholder="5.000,00"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Condições de pagamento</Label>
                <Textarea
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="à vista, mediante recibo."
                  className="text-sm min-h-[60px]"
                />
              </div>
            </TabsContent>

            <TabsContent value="procuracao" className="mt-0">
              <p className="text-xs text-muted-foreground">
                Cliente: <span className="font-medium text-foreground">{clientName}</span> · CPF: {cpf}
              </p>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex flex-col gap-2 mt-4">
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1" size="sm">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Gerar PDF
            </Button>
            <Button
              onClick={handleSave}
              variant="outline"
              className="flex-1"
              size="sm"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Salvar no caso
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyMessage}
            className="text-xs"
          >
            <Copy className="w-3 h-3 mr-1.5" />
            Copiar mensagem para cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
