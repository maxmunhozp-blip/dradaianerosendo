import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { streamLaraChat } from "@/lib/lara-stream";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, Header, Footer, ImageRun, PageBreak, BorderStyle } from "docx";
import { useCallback } from "react";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Copy, RefreshCw, Sparkles, Download, FileDown, Stamp } from "lucide-react";

const FORMAT_INSTRUCTIONS = `

INSTRUÇÕES DE FORMATAÇÃO OBRIGATÓRIAS:
REGRA ABSOLUTA: NÃO faça perguntas, NÃO peça confirmação, NÃO liste dados faltantes. Gere o documento COMPLETO IMEDIATAMENTE com os dados disponíveis. Onde faltar dado, use "___" (sublinhado). NUNCA retorne JSON.
Você DEVE formatar o documento seguindo rigorosamente o padrão forense brasileiro:

1. **Cabeçalho**: Use "# TÍTULO DO DOCUMENTO" centralizado em caixa alta (ex: # EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ___ VARA DE FAMÍLIA DA COMARCA DE ___)
2. **Qualificação das partes**: Nome completo em negrito, seguido de nacionalidade, estado civil, profissão, CPF, RG, endereço. Use dados reais do caso.
3. **Seções**: Use "## " para cada seção principal (DOS FATOS, DO DIREITO, DOS PEDIDOS, etc.) em caixa alta e negrito.
4. **Subseções**: Use "### " para subdivisões.
5. **Parágrafos**: Texto corrido, sem bullets desnecessários. Cada parágrafo em linha separada.
6. **Numeração de itens/pedidos**: Use listas numeradas (1., 2., 3.) apenas para pedidos e requerimentos.
7. **Citações legais**: Artigos de lei em negrito (ex: **Art. 1.694 do Código Civil**).
8. **Valores**: Sempre por extenso entre parênteses (ex: R$ 2.000,00 (dois mil reais)).
9. **Fechamento**: Local, data, nome e OAB da advogada (Dra. Daiane Rosendo, OAB/__).
10. **Espaçamento**: Linhas em branco entre seções. Sem linhas horizontais (---).
11. **Tom**: Formal, técnico, linguagem jurídica adequada. Nunca use emojis.
12. **Completude**: O documento deve estar PRONTO PARA USO, sem campos "[preencher]" — use os dados reais disponíveis. Onde faltar dado, use "___" (sublinhado).
`;

const TEMPLATE_TYPES = [
  { value: "peticao_inicial", label: "Petição Inicial", prompt: `Gere uma PETIÇÃO INICIAL completa e detalhada para o caso selecionado. Estrutura obrigatória: Endereçamento ao juízo competente, Qualificação do autor, Qualificação do réu (se houver dados), DOS FATOS (narrativa detalhada), DO DIREITO (fundamentação legal com artigos), DA TUTELA DE URGÊNCIA (se aplicável), DOS PEDIDOS (numerados), DO VALOR DA CAUSA, fechamento com local/data/advogada.${FORMAT_INSTRUCTIONS}` },
  { value: "contestacao", label: "Contestação", prompt: `Gere uma CONTESTAÇÃO completa para o caso. Estrutura: Endereçamento, Qualificação do réu, DAS PRELIMINARES (se houver), DO MÉRITO (impugnação ponto a ponto), DAS PROVAS, DOS PEDIDOS, fechamento.${FORMAT_INSTRUCTIONS}` },
  { value: "procuracao", label: "Procuração Ad Judicia", prompt: `Gere uma PROCURAÇÃO AD JUDICIA completa. Deve conter: qualificação completa do outorgante (dados do cliente), qualificação da outorgada (Dra. Daiane Rosendo), poderes da cláusula ad judicia et extra com poderes especiais para ação de família, foro de eleição, local e data, espaço para assinatura.${FORMAT_INSTRUCTIONS}` },
  { value: "contrato_honorarios", label: "Contrato de Honorários", prompt: `Gere um CONTRATO DE HONORÁRIOS ADVOCATÍCIOS completo. Cláusulas obrigatórias: DAS PARTES (contratante e contratada), DO OBJETO (tipo de ação), DOS HONORÁRIOS (valor, forma de pagamento, honorários de êxito), DAS OBRIGAÇÕES DA CONTRATADA, DAS OBRIGAÇÕES DO CONTRATANTE, DA VIGÊNCIA, DA RESCISÃO, DO FORO, assinaturas e testemunhas.${FORMAT_INSTRUCTIONS}` },
  { value: "recurso", label: "Recurso / Apelação", prompt: `Gere um RECURSO DE APELAÇÃO completo para o caso. Estrutura: Endereçamento ao Tribunal, DA TEMPESTIVIDADE, DO CABIMENTO, DAS RAZÕES RECURSAIS (erro na sentença, fundamentação legal), DO PEDIDO DE REFORMA, fechamento.${FORMAT_INSTRUCTIONS}` },
  { value: "manifestacao", label: "Manifestação / Réplica", prompt: `Gere uma MANIFESTAÇÃO ou RÉPLICA processual adequada à fase atual do caso. Estrutura: Endereçamento, referência aos autos, DA MANIFESTAÇÃO (resposta ponto a ponto), DOS REQUERIMENTOS, fechamento.${FORMAT_INSTRUCTIONS}` },
  { value: "acordo", label: "Acordo Extrajudicial", prompt: `Gere um ACORDO EXTRAJUDICIAL completo. Cláusulas: DAS PARTES, DO OBJETO, DAS CONDIÇÕES (guarda, visitas, alimentos, partilha conforme o caso), DOS PRAZOS, DO DESCUMPRIMENTO, DAS DISPOSIÇÕES GERAIS, assinaturas com duas testemunhas.${FORMAT_INSTRUCTIONS}` },
  { value: "notificacao", label: "Notificação Extrajudicial", prompt: `Gere uma NOTIFICAÇÃO EXTRAJUDICIAL formal. Estrutura: Identificação do notificante e notificado, DOS FATOS, DA FUNDAMENTAÇÃO LEGAL, DA NOTIFICAÇÃO (o que se exige), DO PRAZO para cumprimento, DAS CONSEQUÊNCIAS do descumprimento, fechamento com AR.${FORMAT_INSTRUCTIONS}` },
];

export default function Templates() {
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [useLetterhead, setUseLetterhead] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: branding } = useQuery({
    queryKey: ["document-branding"],
    queryFn: async () => {
      const { data } = await (supabase.from("document_branding" as any).select("*").eq("is_default", true).maybeSingle()) as any;
      return data;
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["all-cases-for-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleGenerate = async () => {
    if (!selectedCase || !selectedTemplate) {
      toast.error("Selecione um caso e um tipo de documento");
      return;
    }

    const template = TEMPLATE_TYPES.find((t) => t.value === selectedTemplate);
    if (!template) return;

    setIsGenerating(true);
    setGeneratedContent("");

    let content = "";
    const prompt = extraInstructions
      ? `${template.prompt}\n\nInstruções adicionais da advogada: ${extraInstructions}`
      : template.prompt;

    await streamLaraChat({
      messages: [{ role: "user", content: prompt }],
      caseId: selectedCase,
      onDelta: (text) => {
        content += text;
        setGeneratedContent(content);
      },
      onDone: () => {
        setIsGenerating(false);
        toast.success("Documento gerado com sucesso");
      },
      onError: (error) => {
        setIsGenerating(false);
        toast.error(error);
      },
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      toast.success("Documento copiado para a área de transferência");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleExportDocx = async () => {
    if (!generatedContent) return;

    try {
      const b = branding;
      const fontFamily = b?.font_family || "Arial";
      const bodySize = (b?.font_size_body || 12) * 2; // half-points
      const headingSize = (b?.font_size_heading || 14) * 2;
      const primaryColor = (b?.primary_color || "#1E3A5F").replace("#", "");
      const secondaryColor = (b?.secondary_color || "#2B9E8F").replace("#", "");

      const lines = generatedContent.split("\n");
      const children: Paragraph[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          children.push(new Paragraph({ children: [] }));
          continue;
        }

        if (trimmed.startsWith("### ")) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: trimmed.replace(/^###\s*/, ""), bold: true, font: fontFamily, size: bodySize + 2, color: primaryColor })],
          }));
        } else if (trimmed.startsWith("## ")) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: trimmed.replace(/^##\s*/, ""), bold: true, font: fontFamily, size: headingSize, color: primaryColor })],
          }));
        } else if (trimmed.startsWith("# ")) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 360, after: 240 },
            children: [new TextRun({ text: trimmed.replace(/^#\s*/, ""), bold: true, font: fontFamily, size: headingSize + 4, color: primaryColor })],
          }));
        } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          children.push(new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: trimmed.replace(/^[-*]\s*/, ""), font: fontFamily, size: bodySize })],
          }));
        } else if (/^\d+\.\s/.test(trimmed)) {
          children.push(new Paragraph({
            numbering: { reference: "numbers", level: 0 },
            children: [new TextRun({ text: trimmed.replace(/^\d+\.\s*/, ""), font: fontFamily, size: bodySize })],
          }));
        } else {
          const runs: TextRun[] = [];
          const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
          for (const part of parts) {
            if (part.startsWith("**") && part.endsWith("**")) {
              runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: fontFamily, size: bodySize }));
            } else if (part) {
              runs.push(new TextRun({ text: part, font: fontFamily, size: bodySize }));
            }
          }
          children.push(new Paragraph({
            spacing: { after: 120, line: 360 },
            alignment: AlignmentType.JUSTIFIED,
            children: runs,
          }));
        }
      }

      const templateLabel = TEMPLATE_TYPES.find((t) => t.value === selectedTemplate)?.label || "Documento";
      const clientName = (selectedCaseData as any)?.clients?.name || "Cliente";

      // Build header/footer if branding enabled
      const headers: any = {};
      const footers: any = {};

      if (useLetterhead && b) {
        const headerChildren: Paragraph[] = [];
        if (b.header_text) {
          const headerLines = (b.header_text as string).split("\n");
          for (let i = 0; i < headerLines.length; i++) {
            headerChildren.push(new Paragraph({
              children: [new TextRun({
                text: headerLines[i],
                font: fontFamily,
                size: i === 0 ? bodySize : bodySize - 2,
                bold: i === 0,
                color: primaryColor,
              })],
            }));
          }
          headerChildren.push(new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: secondaryColor, space: 1 } },
            children: [],
          }));
        }
        if (headerChildren.length > 0) {
          headers.default = new Header({ children: headerChildren });
        }

        if (b.footer_text) {
          footers.default = new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 3, color: secondaryColor, space: 1 } },
                children: [],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: b.footer_text as string, font: fontFamily, size: bodySize - 4, color: "718096" })],
              }),
            ],
          });
        }
      }

      const mmToDxa = (mm: number) => Math.round(mm * 56.7);

      const doc = new Document({
        numbering: {
          config: [
            {
              reference: "bullets",
              levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
            },
            {
              reference: "numbers",
              levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
            },
          ],
        },
        styles: {
          default: { document: { run: { font: fontFamily, size: bodySize } } },
        },
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: {
                top: mmToDxa(b?.margin_top || 30),
                right: mmToDxa(b?.margin_right || 20),
                bottom: mmToDxa(b?.margin_bottom || 25),
                left: mmToDxa(b?.margin_left || 30),
              },
            },
          },
          headers,
          footers,
          children,
        }],
      });

      const buffer = await Packer.toBlob(doc);
      const fileName = `${templateLabel.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.docx`;
      saveAs(buffer, fileName);
      toast.success("Documento DOCX exportado com papel timbrado!");
    } catch (e) {
      console.error("Erro ao exportar DOCX:", e);
      toast.error("Erro ao exportar documento");
    }
  };

  const handleExportPdf = () => {
    if (!generatedContent) return;

    try {
      const b = branding;
      const templateLabel = TEMPLATE_TYPES.find((t) => t.value === selectedTemplate)?.label || "Documento";
      const clientName = (selectedCaseData as any)?.clients?.name || "Cliente";

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginLeft = b?.margin_left || 30;
      const marginRight = b?.margin_right || 20;
      const marginTop = b?.margin_top || 30;
      const marginBottom = b?.margin_bottom || 25;
      const contentWidth = pageWidth - marginLeft - marginRight;
      let y = marginTop;

      const addHeader = () => {
        if (useLetterhead && b?.header_text) {
          const headerLines = (b.header_text as string).split("\n");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(b.font_size_body || 12);
          for (let i = 0; i < headerLines.length; i++) {
            if (i > 0) pdf.setFont("helvetica", "normal");
            pdf.setFontSize(i === 0 ? (b.font_size_body || 12) : (b.font_size_body || 12) - 1);
            pdf.text(headerLines[i], marginLeft, y);
            y += 5;
          }
          // Separator line
          const secColor = (b.secondary_color || "#2B9E8F").replace("#", "");
          const r = parseInt(secColor.substring(0, 2), 16);
          const g = parseInt(secColor.substring(2, 4), 16);
          const bl = parseInt(secColor.substring(4, 6), 16);
          pdf.setDrawColor(r, g, bl);
          pdf.setLineWidth(0.5);
          pdf.line(marginLeft, y, pageWidth - marginRight, y);
          y += 6;
        }
      };

      const addFooter = () => {
        if (useLetterhead && b?.footer_text) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize((b.font_size_body || 12) - 2);
          pdf.setTextColor(113, 128, 150);
          const footerY = pageHeight - 10;
          pdf.text(b.footer_text as string, pageWidth / 2, footerY, { align: "center" });
          pdf.setTextColor(0, 0, 0);
        }
      };

      addHeader();

      const addPageIfNeeded = (lineHeight: number) => {
        if (y + lineHeight > pageHeight - marginBottom) {
          addFooter();
          pdf.addPage();
          y = marginTop;
          addHeader();
        }
      };

      const lines = generatedContent.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          y += 4;
          continue;
        }

        // Headings
        if (trimmed.startsWith("# ")) {
          const text = trimmed.replace(/^#\s*/, "").replace(/\*\*/g, "");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          const wrapped = pdf.splitTextToSize(text.toUpperCase(), contentWidth);
          addPageIfNeeded(wrapped.length * 7);
          pdf.text(wrapped, pageWidth / 2, y, { align: "center" });
          y += wrapped.length * 7 + 6;
        } else if (trimmed.startsWith("## ")) {
          const text = trimmed.replace(/^##\s*/, "").replace(/\*\*/g, "");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          addPageIfNeeded(8);
          y += 4;
          pdf.text(text.toUpperCase(), marginLeft, y);
          y += 8;
        } else if (trimmed.startsWith("### ")) {
          const text = trimmed.replace(/^###\s*/, "").replace(/\*\*/g, "");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          addPageIfNeeded(7);
          y += 2;
          pdf.text(text, marginLeft, y);
          y += 7;
        } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const text = trimmed.replace(/^[-*]\s*/, "").replace(/\*\*/g, "");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          const wrapped = pdf.splitTextToSize(text, contentWidth - 8);
          addPageIfNeeded(wrapped.length * 5.5);
          pdf.text("•", marginLeft + 2, y);
          pdf.text(wrapped, marginLeft + 8, y);
          y += wrapped.length * 5.5 + 2;
        } else if (/^\d+\.\s/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s*(.*)/);
          const num = numMatch?.[1] || "";
          const text = (numMatch?.[2] || "").replace(/\*\*/g, "");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          const wrapped = pdf.splitTextToSize(text, contentWidth - 10);
          addPageIfNeeded(wrapped.length * 5.5);
          pdf.setFont("helvetica", "bold");
          pdf.text(num, marginLeft, y);
          pdf.setFont("helvetica", "normal");
          pdf.text(wrapped, marginLeft + 10, y);
          y += wrapped.length * 5.5 + 2;
        } else {
          // Regular paragraph - strip bold markers for clean text
          const cleanText = trimmed.replace(/\*\*/g, "");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          const wrapped = pdf.splitTextToSize(cleanText, contentWidth);
          addPageIfNeeded(wrapped.length * 5.5);
          pdf.text(wrapped, marginLeft, y, { align: "justify", maxWidth: contentWidth });
          y += wrapped.length * 5.5 + 2;
        }
      }

      addFooter();
      const fileName = `${templateLabel.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.pdf`;
      pdf.save(fileName);
      toast.success("PDF exportado com papel timbrado!");
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
      toast.error("Erro ao exportar PDF");
    }
  };

  const selectedCaseData = cases?.find((c) => c.id === selectedCase);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates Jurídicos</h1>
          <p className="text-sm text-muted-foreground">
            Gere documentos jurídicos completos com base nos dados do caso
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Case selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Caso</label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o caso..." />
                </SelectTrigger>
                <SelectContent>
                  {cases?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_type} — {(c as any).clients?.name || "Sem cliente"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Case info */}
            {selectedCaseData && (
              <div className="rounded-md border p-3 space-y-1 bg-muted/50">
                <p className="text-xs font-medium">{selectedCaseData.case_type}</p>
                <p className="text-xs text-muted-foreground">
                  Cliente: {(selectedCaseData as any).clients?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {selectedCaseData.status}
                </p>
                {selectedCaseData.cnj_number && (
                  <p className="text-xs text-muted-foreground">
                    CNJ: {selectedCaseData.cnj_number}
                  </p>
                )}
              </div>
            )}

            {/* Template type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Documento</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o template..." />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Extra instructions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Instruções adicionais</label>
              <Textarea
                placeholder="Ex: Incluir pedido de tutela de urgência, valor da causa R$ 5.000..."
                value={extraInstructions}
                onChange={(e) => setExtraInstructions(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {/* Letterhead toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Stamp className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm cursor-pointer" htmlFor="letterhead-toggle">
                  Papel timbrado
                </Label>
              </div>
              <Switch
                id="letterhead-toggle"
                checked={useLetterhead}
                onCheckedChange={setUseLetterhead}
              />
            </div>
            {useLetterhead && !branding && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                Nenhuma configuração de timbrado encontrada.{" "}
                <a href="/settings/document-branding" className="underline font-medium">
                  Configurar agora
                </a>
              </p>
            )}

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedCase || !selectedTemplate}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar Documento
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pré-visualização</CardTitle>
            {generatedContent && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportDocx}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  DOCX
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf}>
                  <FileDown className="w-3.5 h-3.5 mr-1.5" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refazer
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {generatedContent ? (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div
                  ref={contentRef}
                  className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-sm prose-li:text-sm"
                >
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-280px)] text-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Selecione um caso e tipo de documento, depois clique em{" "}
                  <strong>Gerar Documento</strong>
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  O documento será gerado pela LARA com os dados reais do caso
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
