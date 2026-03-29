import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/hooks/use-clients";
import { useCreateCase } from "@/hooks/use-cases";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function QuickCreateCase() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const createCase = useCreateCase();

  const [form, setForm] = useState({
    client_id: "",
    case_type: "Divórcio",
    description: "",
    cnj_number: "",
    court: "",
    status: "documentacao",
  });

  // Cmd+K handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    },
    []
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCreate = async () => {
    if (!form.client_id) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    try {
      const created = await createCase.mutateAsync({
        client_id: form.client_id,
        case_type: form.case_type,
        description: form.description,
        cnj_number: form.cnj_number || null,
        court: form.court || null,
        status: form.status,
      });
      toast.success("Caso criado com sucesso");
      setOpen(false);
      setForm({ client_id: "", case_type: "Divórcio", description: "", cnj_number: "", court: "", status: "documentacao" });
      navigate(`/cases/${created.id}`);
    } catch {
      toast.error("Erro ao criar caso");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Novo caso
            <kbd className="ml-2 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Cmd+K
            </kbd>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Cliente</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.case_type} onValueChange={(v) => setForm({ ...form, case_type: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Divórcio">Divórcio</SelectItem>
                <SelectItem value="Guarda">Guarda</SelectItem>
                <SelectItem value="Alimentos">Alimentos</SelectItem>
                <SelectItem value="Inventário">Inventário</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Etapa inicial</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="documentacao">Documentação</SelectItem>
                <SelectItem value="montagem">Montagem</SelectItem>
                <SelectItem value="protocolo">Protocolo</SelectItem>
                <SelectItem value="andamento">Em andamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva o caso..."
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CNJ (opcional)</Label>
              <Input
                value={form.cnj_number}
                onChange={(e) => setForm({ ...form, cnj_number: e.target.value })}
                placeholder="0000000-00.0000.0.00.0000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Vara (opcional)</Label>
              <Input
                value={form.court}
                onChange={(e) => setForm({ ...form, court: e.target.value })}
                placeholder="Ex: 2a Vara de Família"
                className="mt-1.5"
              />
            </div>
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={createCase.isPending}>
            {createCase.isPending ? "Criando..." : "Criar caso"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
