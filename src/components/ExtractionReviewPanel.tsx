import { useState } from "react";
import { CheckCircle, ChevronRight, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fieldLabels } from "@/hooks/use-extraction";

interface AssignOption {
  label: string;
  value: string;
}

export interface ReviewSuggestion {
  id: string;
  documentId: string;
  documentName: string;
  fieldLabel: string;
  field_path: string;
  value: string;
  currentValue?: string | null;
  confidence: "high" | "medium" | "conflict";
  conflict: boolean;
  assignOptions?: AssignOption[];
  case_id: string;
  client_id: string;
}

interface ExtractionReviewPanelProps {
  suggestions: ReviewSuggestion[];
  clientName: string;
  opposingName: string;
  onClose: () => void;
  onComplete: () => void;
}

function ConflictCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: ReviewSuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-destructive font-semibold">{suggestion.fieldLabel}</span>
          <div className="mt-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              Atual: <span className="font-medium text-foreground">{suggestion.currentValue || "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Novo: <span className="font-medium text-foreground">{suggestion.value}</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Fonte: {suggestion.documentName}</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onReject(suggestion.id)}>
            Manter atual
          </Button>
          <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => onAccept(suggestion.id)}>
            Substituir
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssignmentCard({
  suggestion,
  onAssign,
  onReject,
}: {
  suggestion: ReviewSuggestion;
  onAssign: (id: string, destination: string) => void;
  onReject: (id: string) => void;
}) {
  const options = suggestion.assignOptions || [
    { label: "Cliente", value: "client" },
    { label: "Parte contrária", value: "opposing" },
    { label: "Ignorar", value: "skip" },
  ];

  return (
    <div className="p-4 bg-background rounded-xl border-2 border-border hover:border-accent transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {suggestion.fieldLabel}
          </span>
          <p className="text-foreground font-semibold text-base mt-0.5">{suggestion.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Extraído de: {suggestion.documentName}
          </p>
        </div>
        <button
          onClick={() => onReject(suggestion.id)}
          className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
        >
          <X size={16} />
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-2">Este dado pertence a:</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Button
            key={opt.value}
            variant="outline"
            size="sm"
            className="font-semibold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
            onClick={() => onAssign(suggestion.id, opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Apply a single suggestion to the correct DB table
async function applySuggestionToDB(s: ReviewSuggestion, targetOverride?: string) {
  const [table, field] = s.field_path.split(".");

  // If target override changes destination
  if (targetOverride === "skip") {
    await supabase.from("extraction_suggestions").update({ status: "rejected" }).eq("id", s.id);
    return;
  }

  let actualTable = table;
  let actualField = field;

  // If user assigns a generic field to a specific target
  if (targetOverride === "client" && table === "cases") {
    // Map opposing fields to client equivalents
    const remap: Record<string, string> = {
      opposing_party_name: "name",
      opposing_party_cpf: "cpf",
      opposing_party_address: "address_street",
    };
    actualTable = "clients";
    actualField = remap[field] || field;
  } else if (targetOverride === "opposing" && table === "clients") {
    const remap: Record<string, string> = {
      name: "opposing_party_name",
      cpf: "opposing_party_cpf",
    };
    actualTable = "cases";
    actualField = remap[field] || field;
  }

  if (actualField === "children_add") {
    const childData = JSON.parse(s.value);
    const { data: caseData } = await supabase.from("cases").select("children").eq("id", s.case_id).single();
    const current = (caseData?.children as any[]) || [];
    const exists = current.some((c: any) => (c.name || "").toLowerCase() === (childData.name || "").toLowerCase());
    if (!exists) {
      await supabase.from("cases").update({ children: [...current, childData] } as any).eq("id", s.case_id);
    }
  } else if (actualTable === "clients") {
    await supabase.from("clients").update({ [actualField]: s.value } as any).eq("id", s.client_id);
  } else if (actualTable === "cases") {
    await supabase.from("cases").update({ [actualField]: s.value } as any).eq("id", s.case_id);
  }

  await supabase.from("extraction_suggestions").update({ status: "accepted" }).eq("id", s.id);
}

const normalize = (v: string | null | undefined): string =>
  (v || "").replace(/[.\-\/\s]/g, "").toLowerCase().trim();

const ExtractionReviewPanel = ({
  suggestions: rawSuggestions,
  clientName,
  opposingName,
  onClose,
  onComplete,
}: ExtractionReviewPanelProps) => {
  // Deduplicate and filter out normalized-equal values
  const deduped = (() => {
    const seen = new Set<string>();
    return rawSuggestions.filter((s) => {
      // If normalized values match, silently accept
      if (s.currentValue && normalize(s.value) === normalize(s.currentValue)) {
        supabase.from("extraction_suggestions").update({ status: "accepted" }).eq("id", s.id);
        return false;
      }
      const key = s.field_path + "|" + normalize(s.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const [suggestions, setSuggestions] = useState(deduped);
  const [applying, setApplying] = useState(false);

  const auto = suggestions.filter((s) => s.confidence === "high" && !s.conflict);
  const review = suggestions.filter((s) => s.confidence === "medium");
  const conflicts = suggestions.filter((s) => s.conflict || s.confidence === "conflict");

  const handleAcceptConflict = async (id: string) => {
    const s = suggestions.find((x) => x.id === id);
    if (!s) return;
    try {
      await applySuggestionToDB(s);
      setSuggestions((prev) => prev.filter((x) => x.id !== id));
      toast.success(`"${s.fieldLabel}" atualizado`);
    } catch {
      toast.error("Erro ao aplicar");
    }
  };

  const handleReject = async (target: string) => {
    if (target === "all") {
      // Reject all pending
      const pending = [...review, ...conflicts];
      for (const s of pending) {
        await supabase.from("extraction_suggestions").update({ status: "rejected" }).eq("id", s.id);
      }
      toast.info("Todas as sugestões descartadas");
      onComplete();
      return;
    }
    // Single rejection
    await supabase.from("extraction_suggestions").update({ status: "rejected" }).eq("id", target);
    setSuggestions((prev) => prev.filter((x) => x.id !== target));
    toast.info("Sugestão ignorada");
  };

  const handleAssign = async (id: string, destination: string) => {
    const s = suggestions.find((x) => x.id === id);
    if (!s) return;
    try {
      await applySuggestionToDB(s, destination);
      setSuggestions((prev) => prev.filter((x) => x.id !== id));
      if (destination !== "skip") {
        toast.success(`"${s.fieldLabel}" aplicado`);
      }
    } catch {
      toast.error("Erro ao aplicar");
    }
  };

  const handleConfirmAll = async () => {
    setApplying(true);
    try {
      // Apply remaining review items to their default destination
      const pending = [...review, ...conflicts];
      for (const s of pending) {
        await applySuggestionToDB(s);
      }
      toast.success(`${pending.length} campo(s) aplicados`);
      onComplete();
    } catch {
      toast.error("Erro ao aplicar");
    } finally {
      setApplying(false);
    }
  };

  const needsReview = review.length > 0 || conflicts.length > 0;

  if (!needsReview && auto.length === 0) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-background rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-primary text-2xl font-semibold">Revisão de dados extraídos</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Encontrei <strong className="text-foreground">{initialSuggestions.length} informações</strong> em{" "}
            <strong className="text-foreground">
              {new Set(initialSuggestions.map((s) => s.documentId)).size} documentos
            </strong>
          </p>
          <div className="flex gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-700" />
              <span className="text-xs font-bold text-green-700">{auto.length} aplicados</span>
            </div>
            {review.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full">
                <div className="w-2 h-2 rounded-full bg-amber-600" />
                <span className="text-xs font-bold text-amber-600">{review.length} para confirmar</span>
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-full">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-xs font-bold text-destructive">{conflicts.length} conflitos</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {conflicts.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-destructive uppercase tracking-wider mb-3">
                Conflitos — valor diferente já existe
              </h3>
              <div className="space-y-3">
                {conflicts.map((s) => (
                  <ConflictCard key={s.id} suggestion={s} onAccept={handleAcceptConflict} onReject={handleReject} />
                ))}
              </div>
            </section>
          )}

          {review.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-3">Confirmar destino</h3>
              <div className="space-y-3">
                {review.map((s) => (
                  <AssignmentCard key={s.id} suggestion={s} onAssign={handleAssign} onReject={handleReject} />
                ))}
              </div>
            </section>
          )}

          {auto.length > 0 && (
            <details className="group">
              <summary className="text-sm font-bold text-green-700 uppercase tracking-wider cursor-pointer list-none flex items-center gap-2">
                <CheckCircle size={14} />
                {auto.length} campos aplicados automaticamente
                <ChevronRight size={14} className="ml-auto group-open:rotate-90 transition-transform" />
              </summary>
              <div className="mt-3 space-y-2">
                {auto.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle size={16} className="text-green-700 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-green-700 font-semibold">{s.fieldLabel}</span>
                      <p className="text-sm text-foreground truncate">{s.value}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{s.documentName}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Footer */}
        {needsReview && (
          <div className="p-6 border-t border-border flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => handleReject("all")}
            >
              Descartar tudo
            </Button>
            <Button onClick={handleConfirmAll} disabled={applying}>
              {applying ? "Aplicando..." : "Confirmar e aplicar"}
            </Button>
          </div>
        )}
        {!needsReview && (
          <div className="p-6 border-t border-border flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtractionReviewPanel;
