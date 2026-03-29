import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { streamLaraChat } from "@/lib/lara-stream";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat } from "docx";
import { saveAs } from "file-saver";
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
import { FileText, Loader2, Copy, RefreshCw, Sparkles, Download } from "lucide-react";

const TEMPLATE_TYPES = [
  { value: "peticao_inicial", label: "Petição Inicial", prompt: "Gere uma petição inicial completa e detalhada para o caso, com qualificação das partes, dos fatos, do direito e dos pedidos. Use todos os dados disponíveis do caso e do cliente." },
  { value: "contestacao", label: "Contestação", prompt: "Gere uma contestação completa para o caso, com preliminares, mérito, provas e pedidos. Use os dados do caso." },
  { value: "procuracao", label: "Procuração Ad Judicia", prompt: "Gere um modelo completo de procuração ad judicia para o caso, com todos os poderes necessários para a ação de família correspondente." },
  { value: "contrato_honorarios", label: "Contrato de Honorários", prompt: "Gere um modelo de contrato de honorários advocatícios para o caso, incluindo cláusulas sobre valor, forma de pagamento, obrigações e rescisão." },
  { value: "recurso", label: "Recurso / Apelação", prompt: "Gere um recurso de apelação adequado para o caso, com razões recursais, fundamentação legal e pedidos. Use os dados do caso." },
  { value: "manifestacao", label: "Manifestação / Réplica", prompt: "Gere uma manifestação ou réplica processual para o caso em sua fase atual, utilizando os dados disponíveis." },
  { value: "acordo", label: "Acordo Extrajudicial", prompt: "Gere um modelo de acordo extrajudicial para o caso, com todas as cláusulas necessárias, valores, prazos e condições." },
  { value: "notificacao", label: "Notificação Extrajudicial", prompt: "Gere uma notificação extrajudicial formal para o caso, com identificação das partes, fatos, fundamentos e prazo para cumprimento." },
];

export default function Templates() {
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
      const lines = generatedContent.split("\n");
      const children: Paragraph[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          children.push(new Paragraph({ children: [] }));
          continue;
        }

        // Headings
        if (trimmed.startsWith("### ")) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: trimmed.replace(/^###\s*/, ""), bold: true, font: "Arial", size: 24 })],
          }));
        } else if (trimmed.startsWith("## ")) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: trimmed.replace(/^##\s*/, ""), bold: true, font: "Arial", size: 28 })],
          }));
        } else if (trimmed.startsWith("# ")) {
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: trimmed.replace(/^#\s*/, ""), bold: true, font: "Arial", size: 32 })],
          }));
        } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          children.push(new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: trimmed.replace(/^[-*]\s*/, ""), font: "Arial", size: 24 })],
          }));
        } else if (/^\d+\.\s/.test(trimmed)) {
          children.push(new Paragraph({
            numbering: { reference: "numbers", level: 0 },
            children: [new TextRun({ text: trimmed.replace(/^\d+\.\s*/, ""), font: "Arial", size: 24 })],
          }));
        } else {
          // Parse bold markers
          const runs: TextRun[] = [];
          const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
          for (const part of parts) {
            if (part.startsWith("**") && part.endsWith("**")) {
              runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "Arial", size: 24 }));
            } else if (part) {
              runs.push(new TextRun({ text: part, font: "Arial", size: 24 }));
            }
          }
          children.push(new Paragraph({
            spacing: { after: 120 },
            alignment: AlignmentType.JUSTIFIED,
            children: runs,
          }));
        }
      }

      const templateLabel = TEMPLATE_TYPES.find((t) => t.value === selectedTemplate)?.label || "Documento";
      const clientName = (selectedCaseData as any)?.clients?.name || "Cliente";

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
          default: { document: { run: { font: "Arial", size: 24 } } },
        },
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children,
        }],
      });

      const buffer = await Packer.toBlob(doc);
      const fileName = `${templateLabel.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.docx`;
      saveAs(buffer, fileName);
      toast.success("Documento DOCX exportado com sucesso");
    } catch (e) {
      console.error("Erro ao exportar DOCX:", e);
      toast.error("Erro ao exportar documento");
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
