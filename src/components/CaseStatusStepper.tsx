import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, FileText, Hammer, Send, Scale, CheckCircle2 } from "lucide-react";

const steps = [
  {
    key: "documentacao",
    label: "Documentação",
    icon: FileText,
    description: "Reunir todos os documentos necessários para o caso",
    tasks: [
      "Documentos pessoais do cliente (RG, CPF)",
      "Certidões relevantes ao caso",
      "Comprovantes de residência e renda",
      "Procuração assinada",
    ],
  },
  {
    key: "montagem",
    label: "Montagem",
    icon: Hammer,
    description: "Preparar e organizar as peças processuais",
    tasks: [
      "Revisar documentos recebidos",
      "Redigir petição inicial",
      "Preparar anexos e provas",
      "Validar fundamentação jurídica",
    ],
  },
  {
    key: "protocolo",
    label: "Protocolo",
    icon: Send,
    description: "Protocolar e distribuir a ação no tribunal",
    tasks: [
      "Protocolar petição no sistema do tribunal",
      "Obter número CNJ do processo",
      "Confirmar distribuição da vara",
      "Pagar custas processuais",
    ],
  },
  {
    key: "andamento",
    label: "Em andamento",
    icon: Scale,
    description: "Acompanhar o andamento processual",
    tasks: [
      "Monitorar intimações e prazos",
      "Responder manifestações",
      "Acompanhar audiências",
      "Manter cliente informado",
    ],
  },
  {
    key: "encerrado",
    label: "Encerrado",
    icon: CheckCircle2,
    description: "Caso concluído com trânsito em julgado",
    tasks: [
      "Registrar resultado final",
      "Arquivar documentos",
      "Encerrar pendências financeiras",
      "Enviar relatório final ao cliente",
    ],
  },
];

export function CaseStatusStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = steps.findIndex((s) => s.key === currentStatus);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const handleStepClick = (key: string) => {
    setExpandedStep(expandedStep === key ? null : key);
  };

  return (
    <div>
      <div className="flex items-center gap-0 w-full">
        {steps.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isExpanded = expandedStep === step.key;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
                onClick={() => handleStepClick(step.key)}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-all",
                    "group-hover:ring-2 group-hover:ring-primary/20",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-accent bg-accent text-accent-foreground",
                    !isCompleted && !isCurrent && "border-border bg-background text-muted-foreground",
                    isExpanded && "ring-2 ring-primary/30"
                  )}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap transition-colors",
                    isCurrent ? "text-foreground" : "text-muted-foreground",
                    "group-hover:text-foreground"
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

      {/* Expanded step details */}
      {expandedStep && (() => {
        const step = steps.find((s) => s.key === expandedStep);
        if (!step) return null;
        const stepIndex = steps.indexOf(step);
        const isCompleted = stepIndex < currentIndex;
        const isCurrent = stepIndex === currentIndex;
        const Icon = step.icon;

        return (
          <div className="mt-4 border-t border-border pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  isCompleted ? "bg-primary/10 text-primary" :
                  isCurrent ? "bg-accent/20 text-accent-foreground" :
                  "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{step.label}</h3>
                  {isCompleted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      Concluído
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-medium">
                      Etapa atual
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                <ul className="mt-2 space-y-1">
                  {step.tasks.map((task, ti) => (
                    <li key={ti} className="flex items-center gap-2 text-xs">
                      <div
                        className={cn(
                          "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0",
                          isCompleted
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border"
                        )}
                      >
                        {isCompleted && <Check className="w-2 h-2" />}
                      </div>
                      <span className={cn(
                        isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                      )}>
                        {task}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
