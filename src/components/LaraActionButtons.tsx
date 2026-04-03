import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, ClipboardList, ExternalLink, FileText, Bell, ScanSearch, CheckCircle2, XCircle, Download, PenLine, Save, Send, Mail, AlertCircle, ArrowLeft } from "lucide-react";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";

const LEGAL_DOC_START_PATTERNS = [
  /^#{1,3}\s*(PROCURAÇÃO|CONTRATO|DECLARAÇÃO|PETIÇÃO|REQUERIMENTO|TERMO|ACORDO|NOTIFICAÇÃO|CERTIDÃO|MANDADO|ATO|OFÍCIO|PARECER|MEMORIAL|RECURSO|CONTESTAÇÃO)/im,
  /^(PROCURAÇÃO|CONTRATO|DECLARAÇÃO|PETIÇÃO|REQUERIMENTO|TERMO|ACORDO|NOTIFICAÇÃO|CERTIDÃO|MANDADO|ATO|OFÍCIO|PARECER|MEMORIAL|RECURSO|CONTESTAÇÃO)/im,
  /^\*\*\s*(PROCURAÇÃO|CONTRATO|DECLARAÇÃO|PETIÇÃO|REQUERIMENTO|TERMO|ACORDO|NOTIFICAÇÃO|CERTIDÃO|MANDADO|ATO|OFÍCIO|PARECER|MEMORIAL|RECURSO|CONTESTAÇÃO)/im,
] as const;

const LEGAL_DOC_BODY_HINTS = /(outorgante|outorgado|outorga|procuraç|advogad|petiç|contrat|cláusul|foro|rg\b|cpf\b|residente|domiciliad|qualificaç|poderes|pelo presente instrumento)/i;
const OPERATIONAL_MESSAGE_PATTERN = /(acionando|gerando|vou gerar|em seguida|o sistema ir[aá]|link de assinatura|assinatura eletr[ôo]nica|compreendido|entendido|aguarde|estou acionando)/i;

function stripLaraMetaBlocks(rawContent: string): string {
  return rawContent
    .replace(/ACTIONS_START[\s\S]*?ACTIONS_END/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

/**
 * Extract ONLY the legal document content from an AI message.
 * Strips conversational text (greetings, explanations) and keeps only the formal document.
 * Looks for known legal document headings as start markers.
 */
function extractLegalDocumentContent(rawContent: string): string {
  let text = stripLaraMetaBlocks(rawContent);

  for (const pattern of LEGAL_DOC_START_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      text = text.substring(match.index);
      break;
    }
  }

  if (text.match(/^[^#\*\n]*\n---\n/s)) {
    const hrIndex = text.indexOf("\n---\n");
    if (hrIndex !== -1) {
      text = text.substring(hrIndex + 5).trim();
    }
  }

  return text.trim();
}

function normalizeDocumentText(rawContent: string): string {
  return extractLegalDocumentContent(rawContent)
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

function isLikelyLegalDocument(rawContent: string): boolean {
  const text = extractLegalDocumentContent(rawContent);
  if (!text || text.length < 180) return false;

  const opening = text.slice(0, 220);
  const paragraphCount = text.split(/\n\s*\n|\n/).filter((line) => line.trim().length > 0).length;
  const hasHeading = LEGAL_DOC_START_PATTERNS.some((pattern) => pattern.test(text));
  const hasLegalHints = LEGAL_DOC_BODY_HINTS.test(text);
  const looksOperational = OPERATIONAL_MESSAGE_PATTERN.test(opening) && text.length < 500;

  return !looksOperational && (hasHeading || (hasLegalHints && paragraphCount >= 3 && text.length > 280));
}

function resolveDocumentDraft(messageContent?: string, allMessages?: { role: string; content: string }[]): string {
  const candidates: string[] = [];
  const seen = new Set<string>();

  if (messageContent?.trim()) candidates.push(messageContent);
  for (let i = (allMessages?.length || 0) - 1; i >= 0; i--) {
    const msg = allMessages?.[i];
    if (msg?.role === "assistant" && msg.content?.trim()) {
      candidates.push(msg.content);
    }
  }

  let bestText = "";
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const raw = candidate.trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);

    const extracted = extractLegalDocumentContent(raw);
    const normalized = normalizeDocumentText(raw);
    if (!normalized) continue;

    let score = 0;
    if (isLikelyLegalDocument(raw)) score += 10;
    if (LEGAL_DOC_START_PATTERNS.some((pattern) => pattern.test(extracted))) score += 4;
    if (LEGAL_DOC_BODY_HINTS.test(extracted)) score += 2;
    if (extracted.length > 500) score += 3;
    if (extracted.length > 1000) score += 2;
    if (OPERATIONAL_MESSAGE_PATTERN.test(extracted.slice(0, 220))) score -= 12;
    if (messageContent && raw === messageContent.trim()) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestText = normalized;
    }
  }

  return bestScore >= 6 ? bestText : "";
}

/** Remove accents and special chars from file names for storage compatibility */
function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_");
}

/** Parse TipTap HTML into structured blocks with inline segments for PDF rendering */
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface PdfBlock {
  type: "h1" | "h2" | "h3" | "p" | "hr" | "li";
  segments: TextSegment[];
  align: string;
  listType?: "bullet" | "ordered";
  listIndex?: number;
}

function parseHtmlToBlocks(html: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  function getAlign(el: Element): string {
    return (el as HTMLElement).style?.textAlign || "left";
  }

  function extractSegments(el: Node, inherited: { bold: boolean; italic: boolean; underline: boolean }): TextSegment[] {
    const segments: TextSegment[] = [];
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (text) segments.push({ text, ...inherited });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName.toLowerCase();
        const next = { ...inherited };
        if (tag === "strong" || tag === "b") next.bold = true;
        if (tag === "em" || tag === "i") next.italic = true;
        if (tag === "u") next.underline = true;
        if (tag === "br") {
          segments.push({ text: "\n", ...inherited });
        } else {
          segments.push(...extractSegments(node, next));
        }
      }
    });
    return segments;
  }

  const defaultStyle = { bold: false, italic: false, underline: false };

  function processNode(el: Element) {
    const tag = el.tagName.toLowerCase();
    if (["h1", "h2", "h3", "p"].includes(tag)) {
      blocks.push({ type: tag as any, segments: extractSegments(el, defaultStyle), align: getAlign(el) });
    } else if (tag === "hr") {
      blocks.push({ type: "hr", segments: [], align: "left" });
    } else if (tag === "ul" || tag === "ol") {
      let idx = 0;
      el.querySelectorAll(":scope > li").forEach((li) => {
        idx++;
        blocks.push({
          type: "li",
          segments: extractSegments(li, defaultStyle),
          listType: tag === "ol" ? "ordered" : "bullet",
          listIndex: idx,
          align: getAlign(li),
        });
      });
    } else {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) processNode(child as Element);
      });
    }
  }

  doc.body.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) processNode(child as Element);
  });

  return blocks;
}

function generatePdfFromHtml(html: string): Blob {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 25;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const blocks = parseHtmlToBlocks(html);

  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  function getFontStyle(seg: TextSegment): string {
    if (seg.bold && seg.italic) return "bolditalic";
    if (seg.bold) return "bold";
    if (seg.italic) return "italic";
    return "normal";
  }

  function drawSegments(segments: TextSegment[], fontSize: number, defaultFontStyle: string, lineHeight: number, align: string) {
    pdf.setFontSize(fontSize);

    // If no segments or empty, skip
    const fullText = segments.map(s => s.text).join("");
    if (!fullText.trim()) return;

    // Check if all segments share the same style — use simple path
    const allSameStyle = segments.length <= 1 || segments.every(s =>
      getFontStyle(s) === getFontStyle(segments[0])
    );

    if (allSameStyle) {
      const style = segments.length > 0 ? getFontStyle(segments[0]) : defaultFontStyle;
      pdf.setFont("helvetica", style);
      const lines = pdf.splitTextToSize(fullText, maxWidth);
      for (const line of lines) {
        checkPage(lineHeight);
        let x = margin;
        if (align === "center") x = pageWidth / 2;
        else if (align === "right") x = pageWidth - margin;
        const pdfAlign = (align === "justify" ? "left" : align) as "left" | "center" | "right";
        pdf.text(line, x, y, { align: pdfAlign });
        y += lineHeight;
      }
      return;
    }

    // Mixed styles: render segment by segment, wrapping manually
    // First, split into words with their styles
    interface StyledWord { word: string; style: string; }
    const words: StyledWord[] = [];
    for (const seg of segments) {
      const style = getFontStyle(seg);
      const parts = seg.text.split(/(\s+)/);
      for (const part of parts) {
        if (part) words.push({ word: part, style });
      }
    }

    let lineWords: StyledWord[] = [];
    let lineWidth = 0;

    function flushLine() {
      if (lineWords.length === 0) return;
      checkPage(lineHeight);
      let x = margin;
      if (align === "center") {
        x = (pageWidth - lineWidth) / 2;
      } else if (align === "right") {
        x = pageWidth - margin - lineWidth;
      }
      for (const w of lineWords) {
        pdf.setFont("helvetica", w.style);
        pdf.text(w.word, x, y);
        x += pdf.getTextWidth(w.word);
      }
      y += lineHeight;
      lineWords = [];
      lineWidth = 0;
    }

    for (const w of words) {
      if (w.word === "\n") { flushLine(); continue; }
      pdf.setFont("helvetica", w.style);
      const ww = pdf.getTextWidth(w.word);
      if (lineWidth + ww > maxWidth && lineWords.length > 0) {
        flushLine();
      }
      lineWords.push(w);
      lineWidth += ww;
    }
    flushLine();
  }

  for (const block of blocks) {
    switch (block.type) {
      case "h1":
        checkPage(12);
        y += 3;
        drawSegments(block.segments, 16, "bold", 8, block.align);
        y += 2;
        break;
      case "h2":
        checkPage(10);
        y += 2;
        drawSegments(block.segments, 14, "bold", 7, block.align);
        y += 1.5;
        break;
      case "h3":
        checkPage(8);
        y += 1.5;
        drawSegments(block.segments, 12, "bold", 6, block.align);
        y += 1;
        break;
      case "p": {
        const text = block.segments.map(s => s.text).join("");
        if (!text.trim()) { y += 3; break; }
        drawSegments(block.segments, 11, "normal", 5.5, block.align);
        y += 2;
        break;
      }
      case "li": {
        const prefix = block.listType === "ordered" ? `${block.listIndex}. ` : "• ";
        const prefixSeg: TextSegment = { text: prefix, bold: false, italic: false, underline: false };
        drawSegments([prefixSeg, ...block.segments], 11, "normal", 5.5, block.align);
        y += 1;
        break;
      }
      case "hr":
        checkPage(6);
        y += 2;
        pdf.setDrawColor(180);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 4;
        break;
    }
  }

  return pdf.output("blob");
}

interface LaraAction {
  type: "send_whatsapp" | "create_task" | "open_client" | "generate_document" | "schedule_reminder" | "scan_documents" | "download_document" | "send_for_signature" | "generate_pdf";
  label: string;
  data: Record<string, any>;
}

const ACTION_ICONS: Record<string, typeof MessageSquare> = {
  send_whatsapp: MessageSquare,
  create_task: ClipboardList,
  open_client: ExternalLink,
  generate_document: FileText,
  generate_pdf: FileText,
  schedule_reminder: Bell,
  scan_documents: ScanSearch,
  download_document: Download,
  send_for_signature: PenLine,
};

const ACTION_DESCRIPTIONS: Record<string, (data: Record<string, any>) => string> = {
  send_whatsapp: (d) => `Enviar mensagem via WhatsApp para ${d.phone || "o cliente"}`,
  create_task: (d) => `Criar tarefa: "${d.title || ""}"`,
  open_client: () => `Abrir cadastro do cliente`,
  generate_document: () => `Gerar PDF do documento e salvar no caso`,
  generate_pdf: (d) => `Gerar PDF "${d.document_name || "documento"}" e salvar no caso`,
  schedule_reminder: (d) => `Agendar lembrete: "${d.title || ""}" para ${d.date || "data a definir"}`,
  scan_documents: () => `Escanear documentos pendentes com IA para extrair dados automaticamente`,
  download_document: (d) => `Baixar documento "${d.template || ""}" em ${d.format || "DOCX"}`,
  send_for_signature: (d) => `Enviar "${d.document_name || "documento"}" para assinatura eletrônica via ZapSign`,
};

interface ScanResult {
  name: string;
  status: "pending" | "processing" | "done" | "failed";
}

export function LaraActionButtons({ actions, onScanComplete, messageContent, allMessages, contextCaseId }: { actions: LaraAction[]; onScanComplete?: (summary: string) => void; messageContent?: string; allMessages?: { role: string; content: string }[]; contextCaseId?: string }) {
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<LaraAction | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState<Set<number>>(new Set());

  // Signature form state
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerCpf, setSignerCpf] = useState("");

  // Generated document for signature flow
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);
  const [generatedDocName, setGeneratedDocName] = useState<string>("");

  // PDF Preview state
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewBlob, setPdfPreviewBlob] = useState<Blob | null>(null);
  const [pdfPreviewMeta, setPdfPreviewMeta] = useState<{ docName: string; caseId: string; action: LaraAction; actionIndex: number } | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [clientInfo, setClientInfo] = useState<{ phone: string; name: string; email: string } | null>(null);

  // Email send state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<{ id: string; email: string; label: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Text editor state (before PDF generation)
  const [editingText, setEditingText] = useState(false);
  const [editableText, setEditableText] = useState("");
  const [editMeta, setEditMeta] = useState<{ docName: string; caseId: string; action: LaraAction; actionIndex: number } | null>(null);

  // Signature-after-edit flow: when true, generating PDF from editor will save + open signature dialog
  const [signatureFlowMeta, setSignatureFlowMeta] = useState<{ clientPhone?: string; clientName?: string } | null>(null);

  // All actions including dynamically added ones
  const [dynamicActions, setDynamicActions] = useState<LaraAction[]>([]);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);

  // Fetch client phone/name/email when preview meta is set
  useEffect(() => {
    if (!pdfPreviewMeta?.caseId) { setClientInfo(null); return; }
    (async () => {
      const { data } = await supabase
        .from("cases")
        .select("client_id, clients(name, phone, email)")
        .eq("id", pdfPreviewMeta.caseId)
        .single();
      if (data && (data as any).clients) {
        const c = (data as any).clients;
        setClientInfo({ phone: c.phone || "", name: c.name || "", email: c.email || "" });
      }
    })();
  }, [pdfPreviewMeta?.caseId]);

  // Fetch email accounts
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("email_accounts").select("id, email, label").in("status", ["active", "conectado"]);
      if (data && data.length > 0) {
        setEmailAccounts(data);
        setSelectedAccountId(data[0].id);
      }
    })();
  }, []);

  const allActions = [...actions, ...dynamicActions];

  const handleScan = async (action: LaraAction) => {
    const { case_id, client_id } = action.data;
    if (!case_id) { toast.error("Caso não identificado"); return; }

    setScanning(true);
    setScanResults([]);
    setScanProgress(0);

    try {
      // Fetch pending documents
      const { data: docs, error } = await supabase
        .from("documents")
        .select("id, name, file_url, extraction_status")
        .eq("case_id", case_id)
        .neq("extraction_status", "done");

      const pendingDocs = (docs || []).filter((d: any) => d.file_url);

      if (pendingDocs.length === 0) {
        toast.info("Todos os documentos já foram escaneados");
        setScanning(false);
        return;
      }

      setScanTotal(pendingDocs.length);
      const results: ScanResult[] = pendingDocs.map((d: any) => ({ name: d.name, status: "pending" as const }));
      setScanResults([...results]);

      let successCount = 0;
      const extractedFields: string[] = [];

      for (let i = 0; i < pendingDocs.length; i++) {
        const doc = pendingDocs[i];
        results[i].status = "processing";
        setScanResults([...results]);
        setScanProgress(i);

        try {
          // 30s timeout per document
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          const { data, error: fnError } = await supabase.functions.invoke("process-document", {
            body: {
              document_id: doc.id,
              case_id,
              client_id,
              file_url: doc.file_url,
              file_name: doc.name,
            },
          });

          clearTimeout(timeout);

          if (fnError) throw fnError;

          results[i].status = "done";
          successCount++;

          // Collect extracted fields
          if (data?.extracted_data) {
            const fields = Object.entries(data.extracted_data)
              .filter(([, v]) => v)
              .map(([k]) => k);
            if (fields.length > 0) {
              extractedFields.push(`${doc.name}: ${fields.join(", ")}`);
            }
          }
        } catch {
          results[i].status = "failed";
        }

        setScanResults([...results]);
        setScanProgress(i + 1);
      }

      toast.success(`Escaneamento concluído! ${successCount}/${pendingDocs.length} documentos processados.`);

      // Auto-send summary to LARA
      if (onScanComplete) {
        const summary = extractedFields.length > 0
          ? `Escaneamento concluído. Dados encontrados:\n${extractedFields.join("\n")}\n\nResuma o que foi extraído e sugira próximos passos.`
          : `Escaneamento concluído. ${successCount} documentos processados mas nenhum dado relevante foi extraído. Verifique a qualidade dos documentos.`;
        onScanComplete(summary);
      }
    } catch (e: any) {
      toast.error("Erro ao escanear: " + (e.message || "erro desconhecido"));
    } finally {
      setScanning(false);
      const idx = allActions.indexOf(action);
      setExecuted((prev) => new Set(prev).add(idx));
      setConfirmAction(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "scan_documents") {
      await handleScan(confirmAction);
      return;
    }

    setExecuting(true);

    try {
      switch (confirmAction.type) {
        case "send_whatsapp":
          await supabase.functions.invoke("whatsapp", {
            body: { phone: confirmAction.data.phone, message: confirmAction.data.message },
          });
          toast.success("Mensagem enviada via WhatsApp!");
          break;

        case "create_task":
          if (confirmAction.data.case_id) {
            await (supabase.from("checklist_items") as any).insert({
              case_id: confirmAction.data.case_id,
              label: confirmAction.data.title,
              required_by: confirmAction.data.due_date || null,
            });
          }
          toast.success("Tarefa criada!");
          break;

        case "open_client":
          navigate(`/clients/${confirmAction.data.client_id}`);
          break;

        case "generate_document":
        case "generate_pdf": {
          const docName = confirmAction.data.document_name || confirmAction.data.template || "Documento";
          const caseId = confirmAction.data.case_id && /^[0-9a-f-]{36}$/i.test(confirmAction.data.case_id) ? confirmAction.data.case_id : contextCaseId;
          const cleanText = resolveDocumentDraft(messageContent, allMessages);

          if (!cleanText) { toast.error("Texto do documento não encontrado na conversa"); break; }
          if (!caseId) { toast.error("Caso não identificado"); break; }

          // Always open editor — let user fill in missing fields manually
          const idx = allActions.indexOf(confirmAction);
          setEditableText(cleanText);
          setEditMeta({ docName, caseId, action: confirmAction, actionIndex: idx });
          setEditingText(true);
          setConfirmAction(null);
          break;
        }

        case "download_document":
          navigate(`/templates`);
          break;

        case "send_for_signature": {
          let { document_id, client_phone } = confirmAction.data;
          const signers = [{ name: signerName.trim(), email: signerEmail.trim(), cpf: signerCpf.trim() || undefined }];

          // If no document_id or document doesn't have a file yet, open editor
          let needsEditor = false;
          if (!document_id) {
            needsEditor = true;
          } else {
            const { data: existingDoc } = await supabase
              .from("documents")
              .select("id, file_url")
              .eq("id", document_id)
              .single();
            if (!existingDoc || !existingDoc.file_url) {
              needsEditor = true;
            }
          }

          if (needsEditor) {
            const caseId = (confirmAction.data.case_id && /^[0-9a-f-]{36}$/i.test(confirmAction.data.case_id) ? confirmAction.data.case_id : contextCaseId) || "";
            const docName = confirmAction.data.document_name || "Documento";
            const cleanText = resolveDocumentDraft(messageContent, allMessages);

            if (!cleanText) {
              toast.error("Texto do documento não encontrado na conversa. Gere o documento novamente.");
              break;
            }

            const idx = allActions.indexOf(confirmAction);
            setEditableText(cleanText);
            setEditMeta({ docName, caseId, action: confirmAction, actionIndex: idx });
            setSignatureFlowMeta({
              clientPhone: client_phone,
              clientName: confirmAction.data.client_name,
            });
            setEditingText(true);
            setConfirmAction(null);
            break;
          }

          const { data: sigResult, error: sigError } = await supabase.functions.invoke("send-for-signature", {
            body: { document_id, signers },
          });
          if (sigError) {
            let errorMessage = "Erro ao chamar a função de assinatura.";
            try {
              const body = await (sigError as any).context?.json?.();
              if (body?.error) errorMessage = body.error;
              else errorMessage = sigError.message || errorMessage;
            } catch {
              errorMessage = sigError.message || errorMessage;
            }
            throw new Error(errorMessage);
          }
          if (sigResult?.error) throw new Error(sigResult.error);
          
          // Show success and offer WhatsApp links
          const signerResults = sigResult?.signers || [];
          if (signerResults.length > 0 && client_phone) {
            const firstSigner = signerResults[0];
            const docName = confirmAction.data.document_name || "documento";
            const whatsMsg = `Olá ${firstSigner.name}! Segue o link para assinar o documento "${docName}":\n\n${firstSigner.sign_url}\n\nÉ só clicar no link, rolar até o final e assinar.`;
            const encodedMsg = encodeURIComponent(whatsMsg);
            const phone = client_phone.replace(/\D/g, "");
            window.open(`https://wa.me/${phone}?text=${encodedMsg}`, "_blank", "noopener,noreferrer");
            toast.success("Link de assinatura gerado e WhatsApp aberto!");
          } else {
            toast.success("Documento enviado para assinatura com sucesso!");
          }
          break;
        }

        case "schedule_reminder":
          if (confirmAction.data.case_id) {
            await (supabase.from("hearings") as any).insert({
              case_id: confirmAction.data.case_id,
              title: confirmAction.data.title,
              date: confirmAction.data.date || new Date().toISOString(),
              status: "agendado",
            });
          }
          toast.success("Lembrete agendado!");
          break;
      }

      const idx = allActions.indexOf(confirmAction);
      setExecuted((prev) => new Set(prev).add(idx));
    } catch (e: any) {
      const msg: string = e.message || "Erro desconhecido";
      const isZapSignConfig = msg.includes("402") || msg.includes("sandbox") || msg.includes("token") || msg.includes("plano") || msg.includes("Token");
      const isZapSignDown = msg.includes("fora do ar") || msg.includes("instabilidade") || msg.includes("unreachable") || msg.includes("503");

      if (isZapSignConfig) {
        toast.error(msg, {
          description: "Verifique as configurações do ZapSign.",
          action: { label: "Configurações", onClick: () => window.location.href = "/settings" },
          duration: 8000,
        });
      } else if (isZapSignDown) {
        toast.warning(msg, {
          description: "Tente novamente em alguns minutos.",
          duration: 8000,
        });
      } else {
        toast.error("Erro ao executar: " + msg);
      }
    } finally {
      setExecuting(false);
      setConfirmAction(null);
    }
  };

  if (allActions.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {allActions.map((action, i) => {
          const Icon = ACTION_ICONS[action.type] || ClipboardList;
          const isDone = executed.has(i);
          return (
            <button
              key={i}
              onClick={() => {
                if (!isDone && !scanning) {
                  // Pre-fill signer data for signature actions
                  if (action.type === "send_for_signature") {
                    const signer = action.data.signers?.[0];
                    setSignerName(signer?.name || action.data.client_name || "");
                    setSignerEmail(signer?.email || "");
                    setSignerCpf(signer?.cpf || "");
                  }
                  setConfirmAction(action);
                }
              }}
              disabled={isDone || scanning}
              className="flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-semibold transition-colors"
              style={{
                border: "1.5px solid var(--wizard-primary, #1E3A5F)",
                color: isDone ? "#9CA3AF" : "var(--wizard-primary, #1E3A5F)",
                background: isDone ? "#F3F4F6" : "transparent",
                cursor: isDone || scanning ? "default" : "pointer",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {isDone ? "✓ " : ""}{action.label}
            </button>
          );
        })}
      </div>

      {/* Scan progress panel */}
      {scanning && scanResults.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ScanSearch className="w-3.5 h-3.5 animate-pulse" />
            Escaneando documento {Math.min(scanProgress + 1, scanTotal)} de {scanTotal}...
          </div>
          <Progress value={(scanProgress / scanTotal) * 100} className="h-1.5" />
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {scanResults.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                {r.status === "done" && <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />}
                {r.status === "failed" && <XCircle className="w-3 h-3 text-destructive shrink-0" />}
                {r.status === "processing" && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                {r.status === "pending" && <span className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" />}
                <span className={r.status === "done" ? "text-foreground" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                  {r.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan completed results */}
      {!scanning && scanResults.length > 0 && executed.size > 0 && (
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            Escaneamento concluído — {scanResults.filter(r => r.status === "done").length}/{scanResults.length} processados
          </div>
          <div className="space-y-0.5">
            {scanResults.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                {r.status === "done" ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-destructive" />}
                <span className={r.status === "done" ? "text-foreground" : "text-destructive"}>{r.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!confirmAction && !scanning} onOpenChange={() => { if (!scanning) { setConfirmAction(null); setSignerName(""); setSignerEmail(""); setSignerCpf(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmAction?.type === "send_for_signature" ? "Enviar para assinatura" : "Confirmar ação"}</DialogTitle>
            <DialogDescription>
              {confirmAction && (ACTION_DESCRIPTIONS[confirmAction.type]?.(confirmAction.data) || confirmAction.label)}
            </DialogDescription>
          </DialogHeader>

          {/* Signature form fields */}
          {confirmAction?.type === "send_for_signature" && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="signer-name">Nome do signatário *</Label>
                <Input id="signer-name" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signer-email">E-mail do signatário *</Label>
                <Input id="signer-email" type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signer-cpf">CPF (opcional)</Label>
                <Input id="signer-cpf" value={signerCpf} onChange={e => setSignerCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmAction(null); setSignerName(""); setSignerEmail(""); setSignerCpf(""); }} disabled={executing}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={executing || (confirmAction?.type === "send_for_signature" && (!signerEmail.trim() || !signerName.trim()))}
            >
              {executing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {confirmAction?.type === "send_for_signature" ? "Enviar para assinatura" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text Editor Dialog */}
      <Dialog open={editingText} onOpenChange={(open) => {
        if (!open) {
          setEditingText(false);
          setEditableText("");
          setEditMeta(null);
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {signatureFlowMeta ? <PenLine className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              {signatureFlowMeta ? "Revisar antes de assinar" : "Editar"} — {editMeta?.docName}
            </DialogTitle>
            <DialogDescription>
              {signatureFlowMeta
                ? "Revise e edite o documento antes de gerar o PDF e enviar para assinatura eletrônica."
                : "Revise e edite o texto antes de gerar o PDF."
              }
            </DialogDescription>
          </DialogHeader>
          {/* Placeholder count banner */}
          {editableText && (() => {
            const matches = editableText.match(/\[PREENCHER[^\]]*\]/gi);
            if (!matches || matches.length === 0) return null;
            return (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span><strong>{matches.length}</strong> campo{matches.length > 1 ? "s" : ""} <strong>[PREENCHER]</strong> ainda pendente{matches.length > 1 ? "s" : ""}. Você pode editar agora ou gerar o PDF assim mesmo.</span>
              </div>
            );
          })()}
          <RichTextEditor
            ref={editorRef}
            initialContent={editableText}
            className="flex-1"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setEditingText(false);
              setEditableText("");
              setEditMeta(null);
              setSignatureFlowMeta(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={async () => {
              if (!editMeta) return;
              const html = editorRef.current?.getHTML() || "";
              if (!html.trim()) return;

              // Placeholder validation suspended — allow generation with incomplete fields

              const pdfBlob = generatePdfFromHtml(html);

              if (signatureFlowMeta) {
                // Signature flow: save PDF, then open signature dialog
                const { docName, caseId, action, actionIndex } = editMeta;
                const fileName = `${caseId}/${Date.now()}_${sanitizeFileName(docName)}.pdf`;

                toast.info("Salvando PDF e preparando envio para assinatura...");

                const { error: uploadError } = await supabase.storage
                  .from("case-documents")
                  .upload(fileName, pdfBlob, { contentType: "application/pdf" });

                if (uploadError) {
                  toast.error("Erro ao fazer upload: " + uploadError.message);
                  return;
                }

                const { data: urlData } = supabase.storage
                  .from("case-documents")
                  .getPublicUrl(fileName);

                const { data: newDoc, error: docError } = await supabase
                  .from("documents")
                  .insert({
                    case_id: caseId,
                    name: docName,
                    file_url: urlData.publicUrl,
                    status: "aprovado",
                    category: "peticao",
                    uploaded_by: "lara",
                    signature_status: "none",
                  })
                  .select("id, name")
                  .single();

                if (docError || !newDoc) {
                  toast.error("Erro ao criar documento: " + (docError?.message || "erro desconhecido"));
                  return;
                }

                toast.success(`PDF "${docName}" salvo! Preencha os dados do signatário.`);

                // Close editor and open signature confirmation dialog
                setEditingText(false);
                setEditableText("");
                setEditMeta(null);

                // Set up the signature action with the new document
                const sigAction: LaraAction = {
                  type: "send_for_signature",
                  label: `Enviar "${newDoc.name}" para assinatura`,
                  data: {
                    document_id: newDoc.id,
                    document_name: newDoc.name,
                    client_phone: signatureFlowMeta.clientPhone,
                    client_name: signatureFlowMeta.clientName,
                  },
                };

                // Pre-fill signer info from original action data
                const signer = action.data.signers?.[0];
                setSignerName(signer?.name || action.data.client_name || signatureFlowMeta.clientName || "");
                setSignerEmail(signer?.email || "");
                setSignerCpf(signer?.cpf || "");
                setSignatureFlowMeta(null);
                setConfirmAction(sigAction);
              } else {
                // Normal PDF flow: open preview
                const previewUrl = URL.createObjectURL(pdfBlob);
                setPdfPreviewBlob(pdfBlob);
                setPdfPreviewUrl(previewUrl);
                setPdfPreviewMeta(editMeta);
                setEditingText(false);
                setEditableText("");
                setEditMeta(null);
              }
            }}>
              <FileText className="w-4 h-4 mr-1" /> {signatureFlowMeta ? "Gerar PDF e enviar para assinatura" : "Gerar PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!pdfPreviewUrl} onOpenChange={(open) => {
        if (!open) {
          if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
          setPdfPreviewBlob(null);
          setPdfPreviewMeta(null);
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {pdfPreviewMeta?.docName}
            </DialogTitle>
            <DialogDescription>Revise o documento antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-6">
            <div className="flex flex-col items-center justify-center gap-4 text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Preview pronto para revisão</p>
                <p className="text-sm text-muted-foreground">Abra o PDF em uma nova aba ou baixe antes de salvar no caso.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (pdfPreviewUrl) window.open(pdfPreviewUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-1" /> Abrir preview
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (pdfPreviewUrl) {
                      const a = document.createElement("a");
                      a.href = pdfPreviewUrl;
                      a.download = `${pdfPreviewMeta?.docName || "documento"}.pdf`;
                      a.click();
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-1" /> Baixar PDF
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-wrap pt-2">
            <Button variant="outline" onClick={() => {
              // Go back to editor with current content
              if (pdfPreviewMeta) {
                setEditableText(editorRef.current?.getHTML() || "");
                setEditMeta(pdfPreviewMeta);
                setEditingText(true);
              }
              if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
              setPdfPreviewUrl(null);
              setPdfPreviewBlob(null);
              setPdfPreviewMeta(null);
            }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao editor
            </Button>
            <Button variant="outline" onClick={() => {
              if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
              setPdfPreviewUrl(null);
              setPdfPreviewBlob(null);
              setPdfPreviewMeta(null);
            }}>
              Descartar
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              if (!pdfPreviewBlob || !pdfPreviewMeta) return;
              const phone = clientInfo?.phone || pdfPreviewMeta.action?.data?.client_phone || "";
              const clientNameShort = (clientInfo?.name || pdfPreviewMeta.action?.data?.client_name || "").split(" ")[0];
              const docName = pdfPreviewMeta.docName || "documento";
              const caseId = pdfPreviewMeta.caseId;
              if (!phone) {
                toast.error("Telefone do cliente não encontrado");
                return;
              }
              const cleanPhone = phone.replace(/\D/g, "");
              const whatsNum = cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone;

              // Upload PDF to get a public link to include in the message
              let pdfLink = "";
              try {
                const fileName = `${caseId}/${Date.now()}_${sanitizeFileName(docName)}_wa.pdf`;
                const { error: upErr } = await supabase.storage
                  .from("case-documents")
                  .upload(fileName, pdfPreviewBlob, { contentType: "application/pdf" });
                if (!upErr) {
                  const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(fileName);
                  pdfLink = urlData.publicUrl;
                }
              } catch (_) { /* ignore upload errors */ }

              const msg = encodeURIComponent(
                `Olá ${clientNameShort}! Segue o documento "${docName}" para sua análise e assinatura.${pdfLink ? `\n\n📄 ${pdfLink}` : ""}`
              );

              window.open(`https://wa.me/${whatsNum}?text=${msg}`, "_blank", "noopener,noreferrer");
            }}>
              <MessageSquare className="w-4 h-4 mr-1" /> Enviar via WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              if (!pdfPreviewBlob || !pdfPreviewMeta) return;
              const clientNameShort = (clientInfo?.name || pdfPreviewMeta.action?.data?.client_name || "").split(" ")[0];
              const docName = pdfPreviewMeta.docName || "documento";
              const caseId = pdfPreviewMeta.caseId;

              // Upload PDF to get a public URL for the email link
              const fileName = `${caseId}/${Date.now()}_${sanitizeFileName(docName)}_email.pdf`;
              const { error: upErr } = await supabase.storage
                .from("case-documents")
                .upload(fileName, pdfPreviewBlob, { contentType: "application/pdf" });
              
              let pdfLink = "";
              if (!upErr) {
                const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(fileName);
                pdfLink = urlData.publicUrl;
              }

              setEmailTo(clientInfo?.email || "");
              setEmailSubject(`${docName} - Para sua análise e assinatura`);
              setEmailBody(
                `Olá ${clientNameShort},\n\nSegue o documento "${docName}" para sua análise e assinatura.\n\n${pdfLink ? `Link para download: ${pdfLink}\n\n` : ""}Por favor, revise e entre em contato caso tenha dúvidas.\n\nAtenciosamente`
              );
              setEmailDialogOpen(true);
            }}>
              <Mail className="w-4 h-4 mr-1" /> Enviar por e-mail
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (pdfPreviewUrl) {
                const a = document.createElement("a");
                a.href = pdfPreviewUrl;
                a.download = `${pdfPreviewMeta?.docName || "documento"}.pdf`;
                a.click();
              }
            }}>
              <Download className="w-4 h-4 mr-1" /> Baixar
            </Button>
            <Button onClick={async () => {
              if (!pdfPreviewBlob || !pdfPreviewMeta) {
                toast.error("Erro: PDF não encontrado. Tente gerar novamente.");
                return;
              }
              setSavingPdf(true);
              try {
                const { docName, caseId, action, actionIndex } = pdfPreviewMeta;
                const fileName = `${caseId}/${Date.now()}_${sanitizeFileName(docName)}.pdf`;

                const { error: uploadError } = await supabase.storage
                  .from("case-documents")
                  .upload(fileName, pdfPreviewBlob, { contentType: "application/pdf" });

                if (uploadError) { toast.error("Erro ao fazer upload: " + uploadError.message); return; }

                const { data: urlData } = supabase.storage
                  .from("case-documents")
                  .getPublicUrl(fileName);

                const { data: newDoc, error: docError } = await supabase
                  .from("documents")
                  .insert({
                    case_id: caseId,
                    name: docName,
                    file_url: urlData.publicUrl,
                    status: "aprovado",
                    category: "peticao",
                    uploaded_by: "lara",
                    signature_status: "none",
                  })
                  .select("id, name")
                  .single();

                if (docError) { toast.error("Erro ao criar documento: " + docError.message); return; }

                toast.success(`PDF "${docName}" salvo no caso!`);
                setGeneratedDocId(newDoc.id);
                setGeneratedDocName(newDoc.name);
                setExecuted(prev => new Set(prev).add(actionIndex));
                setDynamicActions(prev => [
                  ...prev,
                  {
                    type: "send_for_signature" as const,
                    label: `Enviar "${newDoc.name}" para assinatura`,
                    data: {
                      document_id: newDoc.id,
                      document_name: newDoc.name,
                      client_phone: action.data.client_phone,
                      client_name: action.data.client_name,
                    },
                  },
                ]);
              } catch (e: any) {
                toast.error("Erro: " + (e.message || "erro desconhecido"));
              } finally {
                setSavingPdf(false);
                if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                setPdfPreviewUrl(null);
                setPdfPreviewBlob(null);
                setPdfPreviewMeta(null);
              }
            }} disabled={savingPdf}>
              {savingPdf && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              <Save className="w-4 h-4 mr-1" /> Salvar no caso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Send Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        if (!open) { setEmailDialogOpen(false); setEmailTo(""); setEmailCc(""); setEmailBcc(""); setShowCcBcc(false); setEmailSubject(""); setEmailBody(""); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Enviar documento por e-mail
            </DialogTitle>
            <DialogDescription>O documento será enviado via SMTP pela conta de e-mail configurada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {emailAccounts.length > 1 && (
              <div className="space-y-1.5">
                <Label>Conta de envio</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                >
                  {emailAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.label} ({acc.email})</option>
                  ))}
                </select>
              </div>
            )}
            {emailAccounts.length === 1 && (
              <div className="text-xs text-muted-foreground">
                Enviando de: <span className="font-medium text-foreground">{emailAccounts[0].email}</span>
              </div>
            )}
            {emailAccounts.length === 0 && (
              <div className="text-sm text-destructive">
                Nenhuma conta de e-mail configurada. Configure uma conta em Administrador → E-mails.
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-to">Para *</Label>
                {!showCcBcc && (
                  <button
                    type="button"
                    onClick={() => setShowCcBcc(true)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + Enviar cópia (CC/BCC)
                  </button>
                )}
              </div>
              <Input id="email-to" type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            {showCcBcc && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="email-cc" className="text-xs">Cópia (CC)</Label>
                    <span className="text-[10px] text-muted-foreground">— receberá o e-mail e todos verão</span>
                  </div>
                  <Input id="email-cc" type="email" value={emailCc} onChange={e => setEmailCc(e.target.value)} placeholder="copia@exemplo.com" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="email-bcc" className="text-xs">Cópia oculta (BCC)</Label>
                    <span className="text-[10px] text-muted-foreground">— receberá o e-mail sem os outros saberem</span>
                  </div>
                  <Input id="email-bcc" type="email" value={emailBcc} onChange={e => setEmailBcc(e.target.value)} placeholder="oculto@exemplo.com" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Assunto</Label>
              <Input id="email-subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-body">Mensagem</Label>
              <textarea
                id="email-body"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-y"
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={sendingEmail}>Cancelar</Button>
            <Button
              disabled={sendingEmail || !emailTo.trim() || !selectedAccountId || emailAccounts.length === 0}
              onClick={async () => {
                setSendingEmail(true);
                try {
                  const { data, error } = await supabase.functions.invoke("send-email", {
                    body: {
                      account_id: selectedAccountId,
                      to: emailTo.trim(),
                      cc: emailCc.trim() || undefined,
                      bcc: emailBcc.trim() || undefined,
                      subject: emailSubject,
                      body: emailBody,
                    },
                  });
                  if (error) throw new Error(error.message);
                  if (data?.error) throw new Error(data.error);
                  toast.success("E-mail enviado com sucesso!");
                  setEmailDialogOpen(false);
                  setEmailTo("");
                  setEmailCc("");
                  setEmailBcc("");
                  setShowCcBcc(false);
                  setEmailSubject("");
                  setEmailBody("");
                } catch (e: any) {
                  toast.error("Erro ao enviar e-mail: " + (e.message || "erro desconhecido"));
                } finally {
                  setSendingEmail(false);
                }
              }}
            >
              {sendingEmail && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              <Send className="w-4 h-4 mr-1" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
