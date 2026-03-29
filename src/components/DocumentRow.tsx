import { StatusBadge } from "./StatusBadge";
import { Download, MoreHorizontal, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocumentRowProps {
  doc: {
    id: string;
    name: string;
    category: string;
    status: string;
    file_url: string | null;
    uploaded_by: string;
    notes: string | null;
  };
}

export function DocumentRow({ doc }: DocumentRowProps) {
  const categoryLabels: Record<string, string> = {
    pessoal: "Pessoal",
    assinado: "Assinado",
    processo: "Processo",
    outro: "Outro",
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
          {doc.category === "processo" && (
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 font-medium gap-1">
              <Scale className="w-2.5 h-2.5" />
              Petição Inicial
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{categoryLabels[doc.category] || doc.category}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {doc.uploaded_by === "advogada" ? "Advogada" : "Cliente"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={doc.status} />
        {doc.file_url && doc.file_url !== "" && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
              <Download className="w-3.5 h-3.5" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
