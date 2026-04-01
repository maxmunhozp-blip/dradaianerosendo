import { CheckCircle, ChevronRight, X, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Suggestion {
  id: string;
  documentId: string;
  documentName: string;
  fieldLabel: string;
  field_path: string;
  value: string;
  currentValue?: string | null;
  confidence: "high" | "medium" | "low";
  conflict: boolean;
}

interface ExtractionReviewPanelProps {
  suggestions: Suggestion[];
  onAccept: (target: string) => void;
  onReject: (target: string) => void;
  onAssign: (id: string, destination: string) => void;
  onClose: () => void;
}

function ConflictCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
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
  suggestion: Suggestion;
  onAssign: (id: string, destination: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="p-4 bg-accent/30 rounded-lg border border-border">
      <div className="flex items-start gap-3">
        <ArrowRight size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-amber-700 font-semibold">{suggestion.fieldLabel}</span>
          <p className="text-sm text-foreground truncate mt-0.5">{suggestion.value}</p>
          <p className="text-xs text-muted-foreground mt-1">Fonte: {suggestion.documentName}</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAssign(suggestion.id, "client")}>
            Cliente
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAssign(suggestion.id, "opposing")}>
            Parte contrária
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => onReject(suggestion.id)}>
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

const ExtractionReviewPanel = ({ suggestions, onAccept, onReject, onAssign, onClose }: ExtractionReviewPanelProps) => {
  const auto = suggestions.filter((s) => s.confidence === "high" && !s.conflict);
  const review = suggestions.filter((s) => s.confidence === "medium" || s.confidence === "low");
  const conflicts = suggestions.filter((s) => s.conflict);

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
            Encontrei <strong className="text-foreground">{suggestions.length} informações</strong> em{" "}
            <strong className="text-foreground">{new Set(suggestions.map((s) => s.documentId)).size} documentos</strong>
          </p>
          <div className="flex gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-700" />
              <span className="text-xs font-bold text-green-700">{auto.length} aplicados</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full">
              <div className="w-2 h-2 rounded-full bg-amber-600" />
              <span className="text-xs font-bold text-amber-600">{review.length} para confirmar</span>
            </div>
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
          {review.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-3">Confirmar destino</h3>
              <div className="space-y-3">
                {review.map((s) => (
                  <AssignmentCard key={s.id} suggestion={s} onAssign={onAssign} onReject={onReject} />
                ))}
              </div>
            </section>
          )}

          {conflicts.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-destructive uppercase tracking-wider mb-3">
                Conflitos — valor diferente já existe
              </h3>
              <div className="space-y-3">
                {conflicts.map((s) => (
                  <ConflictCard key={s.id} suggestion={s} onAccept={onAccept} onReject={onReject} />
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
        <div className="p-6 border-t border-border flex justify-between items-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => onReject("all")}>
            Descartar tudo
          </Button>
          <Button onClick={() => onAccept("pending")}>Confirmar e aplicar</Button>
        </div>
      </div>
    </div>
  );
};

export default ExtractionReviewPanel;
