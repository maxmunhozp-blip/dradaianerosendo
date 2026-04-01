import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Loader2,
  Download,
  Save,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Search,
  Scale,
  PenTool,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateDocument, useUploadDocument } from "@/hooks/use-documents";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";

// ─── PDF formatting helpers ───

interface PdfSection {
  type: "main-heading" | "section-heading" | "sub-heading" | "body" | "item" | "signature" | "spacer";
  text: string;
}

function parsePeticaoSections(raw: string): PdfSection[] {
  const lines = raw.split("\n");
  const sections: PdfSection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { sections.push({ type: "spacer", text: "" }); continue; }

    const clean = line.replace(/\*\*/g, "").replace(/^#+\s*/, "");

    if (/^EXCELENT[ÍI]SSIM/.test(clean) || /^PROCURAÇÃO/.test(clean)) {
      sections.push({ type: "main-heading", text: clean }); continue;
    }
    if (/^(I{1,3}|IV|V|VI{0,3}|IX|X)\s*[—–-]\s/.test(clean) || /^(AÇÃO DE|AÇÃO DECLARATÓRIA)/.test(clean)) {
      sections.push({ type: "section-heading", text: clean }); continue;
    }
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,}:?\s*$/.test(clean) && clean.length < 80) {
      sections.push({ type: "sub-heading", text: clean }); continue;
    }
    if (/^[a-z]\)/.test(clean) || /^\d+\)/.test(clean) || /^[•\-–]\s/.test(clean)) {
      sections.push({ type: "item", text: clean }); continue;
    }
    if (/^_{3,}/.test(clean) || /^Nestes termos/.test(clean) || /^Dra?\.\s/.test(clean) || /^OAB\//.test(clean)) {
      sections.push({ type: "signature", text: clean }); continue;
    }
    sections.push({ type: "body", text: clean });
  }
  return sections;
}

function generateFormattedPdf(
  text: string,
  officeSettings: Record<string, string> | undefined,
  caseData: any,
  clientData: any,
  docType: string = "Petição Inicial"
): { blob: Blob; fileName: string } {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ml = 30, mr = 25, mt = 32, mb = 28;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const cw = pw - ml - mr;

  const oName = officeSettings?.office_name || "Escritório de Advocacia";
  const oOab = officeSettings?.office_oab || "";
  const oAddr = officeSettings?.office_address || "";
  const oPhone = officeSettings?.office_phone || "";
  const oEmail = officeSettings?.office_email || "";

  let curPage = 1, totalPages = 0;

  const drawHeader = () => {
    doc.setDrawColor(180, 130, 30); doc.setLineWidth(0.6);
    doc.line(ml, 14, pw - mr, 14);
    doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 40);
    doc.text(oName.toUpperCase(), ml, 21);
    doc.setFont("times", "normal"); doc.setFontSize(8); doc.setTextColor(100, 100, 120);
    const info = [oOab, oPhone, oEmail].filter(Boolean).join("  |  ");
    if (info) doc.text(info, ml, 25.5);
    if (oAddr) doc.text(oAddr, ml, 29);
    doc.setDrawColor(180, 180, 195); doc.setLineWidth(0.2);
    doc.line(ml, mt, pw - mr, mt);
  };

  const drawFooter = (pn: number, tp: number) => {
    doc.setDrawColor(180, 180, 195); doc.setLineWidth(0.2);
    doc.line(ml, ph - 18, pw - mr, ph - 18);
    doc.setFont("times", "normal"); doc.setFontSize(7.5); doc.setTextColor(130, 130, 150);
    doc.text(oName, ml, ph - 13);
    doc.text(`Página ${pn} de ${tp}`, pw - mr, ph - 13, { align: "right" });
  };

  const sections = parsePeticaoSections(text);

  const getMetrics = (type: string) => {
    switch (type) {
      case "main-heading": return { fs: 13, lh: 6, eb: 8, ea: 6 };
      case "section-heading": return { fs: 12, lh: 5.5, eb: 8, ea: 4 };
      case "sub-heading": return { fs: 11, lh: 5, eb: 6, ea: 3 };
      case "item": return { fs: 11, lh: 5, eb: 1.5, ea: 0 };
      case "signature": return { fs: 11, lh: 5, eb: 3, ea: 0 };
      default: return { fs: 11, lh: 5, eb: 0, ea: 0 };
    }
  };

  // Pass 1: count pages
  let y = mt + 6; totalPages = 1;
  for (const s of sections) {
    if (s.type === "spacer") { y += 4; continue; }
    const m = getMetrics(s.type);
    doc.setFontSize(m.fs);
    const w = doc.splitTextToSize(s.text, s.type === "item" ? cw - 10 : cw);
    const bh = m.eb + w.length * m.lh + m.ea;
    if (y + bh > ph - mb) { totalPages++; y = mt + 6; }
    y += bh;
  }

  // Pass 2: render
  drawHeader(); y = mt + 6; curPage = 1;
  const np = () => { drawFooter(curPage, totalPages); doc.addPage(); curPage++; drawHeader(); y = mt + 6; };

  for (const s of sections) {
    if (s.type === "spacer") { y += 4; continue; }
    const m = getMetrics(s.type);
    const bold = ["main-heading", "section-heading", "sub-heading"].includes(s.type);
    const center = s.type === "main-heading" || s.type === "signature";
    const xOff = s.type === "item" ? 10 : 0;
    const tc: [number, number, number] = bold ? [15, 15, 35] : [40, 40, 60];

    doc.setFont("times", bold ? "bold" : "normal");
    doc.setFontSize(m.fs);
    const wrapped = doc.splitTextToSize(s.text, cw - xOff);
    const bh = m.eb + wrapped.length * m.lh + m.ea;
    if (y + bh > ph - mb) np();

    y += m.eb;
    doc.setTextColor(...tc);
    for (const wl of wrapped) {
      if (y > ph - mb) np();
      if (center) doc.text(wl, pw / 2, y, { align: "center" });
      else doc.text(wl, ml + xOff, y);
      y += m.lh;
    }
    y += m.ea;
  }
  drawFooter(curPage, totalPages);

  const cn = (clientData.name || "cliente").split(" ").slice(0, 2).join("-").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const dt = docType.toLowerCase().replace(/\s+/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ds = new Date().toISOString().slice(0, 10);
  const fileName = `${dt}_${cn}_${ds}.pdf`;
  return { blob: doc.output("blob"), fileName };
}

const REVIEW_CHECKLIST = [
  { id: "qualificacao", label: "Qualificação das partes completa (nome, CPF, RG, endereço)" },
  { id: "fundamentacao", label: "Fundamentação jurídica com leis corretas e verificadas" },
  { id: "pedidos", label: "Pedidos claros e objetivos" },
  { id: "valor", label: "Valor da causa informado" },
  { id: "ortografia", label: "Revisão ortográfica e gramatical" },
  { id: "dados", label: "Dados sensíveis corretos (números, datas, valores)" },
];

interface PeticaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseData: any;
  clientData: any;
  documents: any[];
  checklist: any[];
}

const GENERATION_STEPS = [
  { label: "Lendo documentos...", icon: FileText },
  { label: "Analisando fatos...", icon: Search },
  { label: "Pesquisando fundamentos jurídicos...", icon: Scale },
  { label: "Redigindo petição...", icon: PenTool },
];

export function PeticaoModal({
  open,
  onOpenChange,
  caseId,
  caseData,
  clientData,
  documents,
  checklist,
}: PeticaoModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [genStep, setGenStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reviewChecks, setReviewChecks] = useState<Set<string>>(new Set());
  const [docType, setDocType] = useState("Petição Inicial");
  const editorRef = useRef<HTMLDivElement>(null);
  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocument();

  // Load office settings for PDF header
  const { data: officeSettings } = useQuery({
    queryKey: ["settings-office-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["office_name", "office_oab", "office_address", "office_phone", "office_email"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Initialize all docs as selected
  useEffect(() => {
    if (open) {
      setSelectedDocs(new Set(documents.map((d) => d.id)));
      setStep(1);
      setGeneratedText("");
      setAdditionalContext("");
      setGenStep(0);
      setReviewChecks(new Set());
      setDocType("Petição Inicial");
    }
  }, [open, documents]);

  const toggleDoc = (docId: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const handleGenerate = async () => {
    setStep(2);
    setGeneratedText("");
    setGenStep(0);

    // Animate generation steps
    const stepInterval = setInterval(() => {
      setGenStep((prev) => {
        if (prev >= GENERATION_STEPS.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);

    try {
      const selectedDocData = documents
        .filter((d) => selectedDocs.has(d.id))
        .map((d) => ({
          name: d.name,
          category: d.category,
          file_url: d.file_url,
        }));

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-peticao`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          caseData: {
            case_type: caseData.case_type,
            status: caseData.status,
            court: caseData.court,
            cnj_number: caseData.cnj_number,
            description: caseData.description,
          },
          clientData: {
            name: clientData.name,
            cpf: clientData.cpf,
            email: clientData.email,
            phone: clientData.phone,
            nationality: clientData.nationality,
            marital_status: clientData.marital_status,
            profession: clientData.profession,
            rg: clientData.rg,
            address_street: clientData.address_street,
            address_number: clientData.address_number,
            address_city: clientData.address_city,
            address_state: clientData.address_state,
            address_zip: clientData.address_zip,
          },
          documentUrls: selectedDocData,
          additionalContext,
        }),
      });

      clearInterval(stepInterval);
      setGenStep(GENERATION_STEPS.length - 1);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      // Stream the response
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setGeneratedText(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setStep(3);
    } catch (err: any) {
      clearInterval(stepInterval);
      toast.error("Erro ao gerar petição: " + err.message);
      setStep(1);
    }
  };

  const handleDownloadPdf = () => {
    const text = editorRef.current?.innerText || generatedText;
    const doc = new jsPDF();
    const margin = 25;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;

    const officeName = officeSettings?.office_name || "Escritório de Advocacia";
    const officeOab = officeSettings?.office_oab || "";
    const officeAddress = officeSettings?.office_address || "";
    const officePhone = officeSettings?.office_phone || "";
    const officeEmail = officeSettings?.office_email || "";

    const drawHeader = (pageNum: number) => {
      // Top line accent
      doc.setDrawColor(245, 158, 11); // amber-500
      doc.setLineWidth(0.8);
      doc.line(margin, 12, pageWidth - margin, 12);

      // Office name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // navy
      doc.text(officeName, margin, 22);

      // OAB + contact info line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      const infoLine = [officeOab, officePhone, officeEmail].filter(Boolean).join("  •  ");
      if (infoLine) doc.text(infoLine, margin, 28);
      if (officeAddress) doc.text(officeAddress, margin, 33);

      // Separator line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      const sepY = officeAddress ? 37 : 32;
      doc.line(margin, sepY, pageWidth - margin, sepY);

      return sepY + 8; // return start Y for content
    };

    const drawFooter = (pageNum: number, totalPages: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`${officeName}`, margin, pageHeight - 12);
      doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: "right" });
    };

    // Split text into lines
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = 5.5;

    // Calculate total pages first
    let tempY = drawHeader(1);
    let totalPages = 1;
    for (const line of lines) {
      if (tempY + lineHeight > pageHeight - 25) {
        totalPages++;
        tempY = 45; // subsequent page header space
      }
      tempY += lineHeight;
    }

    // Now render
    let y = drawHeader(1);
    let currentPage = 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // slate-800

    for (const line of lines) {
      if (y + lineHeight > pageHeight - 25) {
        drawFooter(currentPage, totalPages);
        doc.addPage();
        currentPage++;
        y = drawHeader(currentPage);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }

    drawFooter(currentPage, totalPages);

    const clientFirstName = clientData.name?.split(" ")[0] || "cliente";
    doc.save(`peticao-inicial-${clientFirstName}.pdf`);
    toast.success("PDF baixado com sucesso");
  };

  const handleSaveToCase = async () => {
    setSaving(true);
    try {
      const text = editorRef.current?.innerText || generatedText;
      const blob = new Blob([text], { type: "text/plain" });
      const file = new File([blob], `peticao-inicial-${Date.now()}.txt`, { type: "text/plain" });

      const fileUrl = await uploadDoc.mutateAsync({ file, caseId });
      await createDoc.mutateAsync({
        case_id: caseId,
        name: "Petição Inicial",
        file_url: fileUrl,
        category: "processo",
        status: "usado",
        uploaded_by: "advogada",
      });

      toast.success("Petição salva no caso com sucesso");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const doneChecklist = checklist.filter((i) => i.done);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Montar Petição Inicial</h2>
              <p className="text-xs text-muted-foreground">
                {caseData.case_type} — {clientData.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full ${
                  s === step
                    ? "bg-primary"
                    : s < step
                    ? "bg-accent"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* STEP 1 — Revisão */}
          {step === 1 && (
            <div className="p-6 space-y-6">
              {/* Case summary */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Resumo do caso</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium text-foreground">{clientData.name}</p>
                    {clientData.cpf && (
                      <p className="text-xs text-muted-foreground mt-0.5">CPF: {clientData.cpf}</p>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Tipo de ação</p>
                    <p className="font-medium text-foreground">{caseData.case_type}</p>
                    {caseData.court && (
                      <p className="text-xs text-muted-foreground mt-0.5">Vara: {caseData.court}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Documentos ({selectedDocs.size}/{documents.length} selecionados)
                </h3>
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum documento neste caso.</p>
                ) : (
                  <div className="border border-border rounded-md divide-y divide-border">
                    {documents.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedDocs.has(doc.id)}
                          onCheckedChange={() => toggleDoc(doc.id)}
                        />
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground flex-1">{doc.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {doc.category}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Done checklist */}
              {doneChecklist.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    Checklist concluído ({doneChecklist.length})
                  </h3>
                  <div className="space-y-1">
                    {doneChecklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-accent" />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional context */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Informações adicionais</h3>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Descreva os fatos, argumentos específicos, valores, nomes de partes adversárias, endereços, ou qualquer contexto que ajude a LARA redigir a petição..."
                  rows={5}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2 — Generating */}
          {step === 2 && (
            <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-6" />
              <p className="text-sm font-medium text-foreground mb-6">Gerando petição inicial...</p>
              <div className="space-y-3 w-64">
                {GENERATION_STEPS.map((gs, i) => {
                  const StepIcon = gs.icon;
                  const isActive = i === genStep;
                  const isDone = i < genStep;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-sm transition-all ${
                        isActive
                          ? "text-foreground font-medium"
                          : isDone
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <StepIcon className="w-4 h-4 shrink-0" />
                      )}
                      {gs.label}
                    </div>
                  );
                })}
              </div>

              {/* Show streaming text preview */}
              {generatedText && (
                <div className="mt-6 w-full max-h-40 overflow-y-auto bg-muted/30 rounded-md p-3">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                    {generatedText.slice(0, 500)}...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Result */}
          {step === 3 && (
            <div className="p-6">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[400px] max-h-[60vh] overflow-y-auto border border-border rounded-md p-6 text-sm text-foreground whitespace-pre-wrap leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                dangerouslySetInnerHTML={{ __html: generatedText.replace(/\n/g, "<br>") }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          {step === 1 && (
            <>
              <div />
              <Button onClick={handleGenerate}>
                Gerar Petição
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Voltar
              </Button>
              <div />
            </>
          )}

          {step === 3 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Regenerar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Baixar PDF
                </Button>
                <Button size="sm" onClick={handleSaveToCase} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-4 h-4 mr-1.5" />
                  )}
                  {saving ? "Salvando..." : "Salvar no caso"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
