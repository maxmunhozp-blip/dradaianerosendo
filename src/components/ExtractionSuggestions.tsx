import { Check, X, Sparkles, FileSearch, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  usePendingSuggestions,
  useApplySuggestion,
  useRejectSuggestion,
  useApplyAllSuggestions,
  fieldLabels,
} from "@/hooks/use-extraction";
import { toast } from "sonner";
import { useState } from "react";

export function ExtractionSuggestions({ clientId }: { clientId: string }) {
  const { data: suggestions = [], isLoading } = usePendingSuggestions(clientId);
  const applySuggestion = useApplySuggestion();
  const rejectSuggestion = useRejectSuggestion();
  const applyAll = useApplyAllSuggestions();
  const [expanded, setExpanded] = useState(true);

  if (isLoading || suggestions.length === 0) return null;

  const handleApply = async (suggestion: typeof suggestions[0]) => {
    try {
      await applySuggestion.mutateAsync(suggestion);
      toast.success(`"${fieldLabels[suggestion.field_path] || suggestion.field_path}" aplicado!`);
    } catch {
      toast.error("Erro ao aplicar sugestão");
    }
  };

  const handleReject = async (suggestion: typeof suggestions[0]) => {
    try {
      await rejectSuggestion.mutateAsync({ id: suggestion.id, clientId });
      toast.info("Sugestão ignorada");
    } catch {
      toast.error("Erro ao ignorar sugestão");
    }
  };

  const handleApplyAll = async () => {
    try {
      await applyAll.mutateAsync(suggestions);
      toast.success(`${suggestions.length} campo(s) aplicados automaticamente!`);
    } catch {
      toast.error("Erro ao aplicar sugestões");
    }
  };

  const displayValue = (s: typeof suggestions[0]) => {
    if (s.field_path === "cases.children_add") {
      try {
        const child = JSON.parse(s.suggested_value);
        return `${child.name} (${child.birth_date})`;
      } catch {
        return s.suggested_value;
      }
    }
    return s.suggested_value;
  };

  return (
    <div className="mb-6 border border-amber-200 bg-amber-50/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Dados extraídos automaticamente ({suggestions.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={(e) => { e.stopPropagation(); handleApplyAll(); }}
              disabled={applyAll.isPending}
            >
              <Check className="w-3 h-3 mr-1" />
              Aplicar todos
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between bg-white rounded-md border border-amber-100 p-2.5"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileSearch className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {displayValue(s)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fieldLabels[s.field_path] || s.field_path}
                    {s.current_value && s.current_value !== "" && (
                      <span className="text-amber-600 ml-1">
                        (atual: {s.current_value})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleApply(s)}
                  disabled={applySuggestion.isPending}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleReject(s)}
                  disabled={rejectSuggestion.isPending}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
