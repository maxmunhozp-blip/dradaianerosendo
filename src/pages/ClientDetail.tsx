import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useClient, useUpdateClient } from "@/hooks/use-clients";
import { useCasesByClient, useCreateCase } from "@/hooks/use-cases";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Phone, Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id!);
  const { data: cases = [] } = useCasesByClient(id!);
  const updateClient = useUpdateClient();
  const createCase = useCreateCase();

  const [notes, setNotes] = useState<string | null>(null);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [caseForm, setCaseForm] = useState({
    case_type: "Divórcio",
    description: "",
    cnj_number: "",
    court: "",
  });

  if (isLoading) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Carregando...</p></div>;
  }

  if (!client) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Cliente não encontrado.</p></div>;
  }

  const handleSaveNotes = async () => {
    try {
      await updateClient.mutateAsync({ id: client.id, notes: notes ?? client.notes ?? "" });
      toast.success("Anotações salvas");
    } catch {
      toast.error("Erro ao salvar anotações");
    }
  };

  const handleCreateCase = async () => {
    if (!caseForm.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    try {
      await createCase.mutateAsync({
        client_id: client.id,
        case_type: caseForm.case_type,
        description: caseForm.description,
        cnj_number: caseForm.cnj_number || null,
        court: caseForm.court || null,
      });
      toast.success("Caso criado com sucesso");
      setCaseDialogOpen(false);
      setCaseForm({ case_type: "Divórcio", description: "", cnj_number: "", court: "" });
    } catch {
      toast.error("Erro ao criar caso");
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/clients">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Voltar
        </Link>
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {client.cpf && <span>CPF: {client.cpf}</span>}
            {client.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {client.phone}
              </span>
            )}
            {client.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> {client.email}
              </span>
            )}
          </div>
          {client.origin && <p className="text-xs text-muted-foreground mt-1">Origem: {client.origin}</p>}
        </div>
      </div>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Casos ({cases.length})</TabsTrigger>
          <TabsTrigger value="notes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Casos</h2>
            <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Novo caso
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo caso</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={caseForm.case_type} onValueChange={(v) => setCaseForm({ ...caseForm, case_type: v })}>
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
                    <Label>Descrição</Label>
                    <Textarea
                      value={caseForm.description}
                      onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })}
                      placeholder="Descreva o caso..."
                      className="mt-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Número CNJ (opcional)</Label>
                      <Input
                        value={caseForm.cnj_number}
                        onChange={(e) => setCaseForm({ ...caseForm, cnj_number: e.target.value })}
                        placeholder="0000000-00.0000.0.00.0000"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Vara (opcional)</Label>
                      <Input
                        value={caseForm.court}
                        onChange={(e) => setCaseForm({ ...caseForm, court: e.target.value })}
                        placeholder="Ex: 2a Vara de Família"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleCreateCase} disabled={createCase.isPending}>
                    {createCase.isPending ? "Criando..." : "Criar caso"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caso registrado.</p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {cases.map((c) => (
                <Link
                  key={c.id}
                  to={`/cases/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.case_type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                    {c.cnj_number && (
                      <p className="text-xs text-muted-foreground mt-0.5">CNJ: {c.cnj_number}</p>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Textarea
            value={notes ?? client.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações sobre o cliente..."
            className="min-h-[200px]"
          />
          <Button size="sm" className="mt-3" onClick={handleSaveNotes} disabled={updateClient.isPending}>
            Salvar
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
