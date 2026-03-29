import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  // Client statuses
  prospect: { label: "Prospect", className: "bg-muted text-muted-foreground" },
  contrato: { label: "Contrato", className: "bg-accent/20 text-accent-foreground" },
  ativo: { label: "Ativo", className: "bg-success/15 text-success" },
  encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
  // Case statuses
  documentacao: { label: "Documentação", className: "bg-accent/20 text-accent-foreground" },
  montagem: { label: "Montagem", className: "bg-accent/20 text-accent-foreground" },
  protocolo: { label: "Protocolo", className: "bg-primary/10 text-primary" },
  andamento: { label: "Em andamento", className: "bg-success/15 text-success" },
  // Document statuses
  solicitado: { label: "Solicitado", className: "bg-accent/20 text-accent-foreground" },
  recebido: { label: "Recebido", className: "bg-primary/10 text-primary" },
  assinado: { label: "Assinado", className: "bg-success/15 text-success" },
  usado: { label: "Usado", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
