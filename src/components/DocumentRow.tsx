import { StatusBadge } from "./StatusBadge";
import { Download, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Document } from "@/lib/types";

export function DocumentRow({ doc }: { doc: Document }) {
  const categoryLabels: Record<string, string> = {
    pessoal: "Pessoal",
    assinado: "Assinado",
    processo: "Processo",
    outro: "Outro",
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{categoryLabels[doc.category]}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {doc.uploaded_by === "advogada" ? "Advogada" : "Cliente"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={doc.status} />
        {doc.file_url && doc.file_url !== "" && (
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Download className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
