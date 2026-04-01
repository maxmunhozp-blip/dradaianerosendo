import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, ClipboardList, ExternalLink, FileText, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface LaraAction {
  type: "send_whatsapp" | "create_task" | "open_client" | "generate_document" | "schedule_reminder";
  label: string;
  data: Record<string, any>;
}

const ACTION_ICONS: Record<string, typeof MessageSquare> = {
  send_whatsapp: MessageSquare,
  create_task: ClipboardList,
  open_client: ExternalLink,
  generate_document: FileText,
  schedule_reminder: Bell,
};

const ACTION_DESCRIPTIONS: Record<string, (data: Record<string, any>) => string> = {
  send_whatsapp: (d) => `Enviar mensagem via WhatsApp para ${d.phone || "o cliente"}`,
  create_task: (d) => `Criar tarefa: "${d.title || ""}"`,
  open_client: () => `Abrir cadastro do cliente`,
  generate_document: () => `Abrir gerador de documentos para este caso`,
  schedule_reminder: (d) => `Agendar lembrete: "${d.title || ""}" para ${d.date || "data a definir"}`,
};

export function LaraActionButtons({ actions }: { actions: LaraAction[] }) {
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<LaraAction | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState<Set<number>>(new Set());

  const handleConfirm = async () => {
    if (!confirmAction) return;
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
          navigate(`/cases/${confirmAction.data.case_id}`);
          break;

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

      const idx = actions.indexOf(confirmAction);
      setExecuted((prev) => new Set(prev).add(idx));
    } catch (e: any) {
      toast.error("Erro ao executar: " + (e.message || "erro desconhecido"));
    } finally {
      setExecuting(false);
      setConfirmAction(null);
    }
  };

  if (actions.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action, i) => {
          const Icon = ACTION_ICONS[action.type] || ClipboardList;
          const isDone = executed.has(i);
          return (
            <button
              key={i}
              onClick={() => !isDone && setConfirmAction(action)}
              disabled={isDone}
              className="flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-semibold transition-colors"
              style={{
                border: "1.5px solid var(--wizard-primary, #1E3A5F)",
                color: isDone ? "#9CA3AF" : "var(--wizard-primary, #1E3A5F)",
                background: isDone ? "#F3F4F6" : "transparent",
                cursor: isDone ? "default" : "pointer",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {isDone ? "✓ " : ""}{action.label}
            </button>
          );
        })}
      </div>

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar ação</DialogTitle>
            <DialogDescription>
              {confirmAction && (ACTION_DESCRIPTIONS[confirmAction.type]?.(confirmAction.data) || confirmAction.label)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={executing}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={executing}>
              {executing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
