import { CheckCircle, AlertCircle } from "lucide-react";

interface DocResult {
  confidence?: string;
  fieldsFound?: number;
}

interface ExtractionProgressProps {
  documents: { id: string; name: string }[];
  currentIndex: number;
  results: Record<string, DocResult>;
}

const ExtractionProgress = ({ documents, currentIndex, results }: ExtractionProgressProps) => (
  <div className="space-y-2 p-4 bg-background rounded-xl border border-border shadow-sm">
    <p className="font-semibold text-primary text-base mb-3">
      Analisando documentos...
    </p>
    {documents.map((doc, i) => {
      const result = results[doc.id];
      const state = i < currentIndex ? "done" : i === currentIndex ? "loading" : "waiting";
      return (
        <div key={doc.id} className="flex items-center gap-3 py-2">
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
            {state === "done" && result?.confidence === "high" && (
              <CheckCircle size={20} className="text-green-700" />
            )}
            {state === "done" && result?.confidence !== "high" && (
              <AlertCircle size={20} className="text-amber-600" />
            )}
            {state === "loading" && (
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            )}
            {state === "waiting" && (
              <div className="w-2 h-2 rounded-full bg-border" />
            )}
          </div>
          <span className={`text-sm ${state === "waiting" ? "text-muted-foreground" : "text-foreground"}`}>
            {doc.name}
          </span>
          {state === "done" && (
            <span className="ml-auto text-xs font-semibold text-muted-foreground">
              {result?.fieldsFound ?? 0} campos encontrados
            </span>
          )}
        </div>
      );
    })}
  </div>
);

export default ExtractionProgress;
