import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const steps = [
  { key: "documentacao", label: "Documentação" },
  { key: "montagem", label: "Montagem" },
  { key: "protocolo", label: "Protocolo" },
  { key: "andamento", label: "Em andamento" },
  { key: "encerrado", label: "Encerrado" },
];

export function CaseStatusStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = steps.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-accent bg-accent text-accent-foreground",
                  !isCompleted && !isCurrent && "border-border bg-background text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-2 mt-[-18px]",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
