import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useClient, useUpdateClient, useDeleteClient } from "@/hooks/use-clients";
import { useCasesByClient, useCreateCase } from "@/hooks/use-cases";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Phone, Mail, Plus, FolderOpen, Send, Loader2, Pencil, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id!);
  const { data: cases = [] } = useCasesByClient(id!);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const createCase = useCreateCase();

  const [notes, setNotes] = useState<string | null>(null);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    origin: "",
    status: "",
  });
  const [caseForm, setCaseForm] = useState({
    case_type: "Divórcio",
    description: "",
    cnj_number: "",
    court: "",
  });

  const startEditing = () => {
    if (!client) return;
    setEditForm({
      name: client.name,
      cpf: client.cpf || "",
      phone: client.phone || "",
      email: client.email || "",
      origin: client.origin || "",
      status: client.status,
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!client) return;
    if (!editForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      await updateClient.mutateAsync({
        id: client.id,
        name: editForm.name,
        cpf: editForm.cpf || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        origin: editForm.origin || null,
        status: editForm.status,
      });
      toast.success("Cliente atualizado com sucesso");
      setEditing(false);
    } catch {
      toast.error("Erro ao atualizar cliente");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!client) return;
    try {
      await updateClient.mutateAsync({ id: client.id, status: newStatus });
      toast.success(`Status alterado para ${newStatus}`);
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("Cliente removido");
      navigate("/clients");
    } catch {
      toast.error("Erro ao remover cliente. Verifique se não há casos vinculados.");
    }
  };

  const handleInviteClient = async () => {
    if (!client?.email) {
      toast.error("Cliente não possui e-mail cadastrado");
      return;
    }
    setInviting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: client.email,
        options: {
          emailRedirectTo: `${window.location.origin}/portal`,
        },
      });
      if (error) throw error;
      toast.success(`Convite enviado para ${client.email}`);
    } catch (err: any) {
      toast.error("Erro ao enviar convite: " + err.message);
    } finally {
      setInviting(false);
    }
  };

  if (isLoading) return <DetailSkeleton />;

  if (!client) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FolderOpen}
          title="Cliente não encontrado"
          description="Este cliente pode ter sido removido ou o link está incorreto."
        />
      </div>
    );
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

      {editing ? (
        <div className="border border-border rounded-lg p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Editar cliente</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={updateClient.isPending}>
                {updateClient.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Nome completo</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={editForm.cpf} onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                const masked = digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                setEditForm({ ...editForm, cpf: masked });
              }} placeholder="000.000.000-00" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="(00) 00000-0000" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="email@exemplo.com" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Origem</Label>
              <Select value={editForm.origin} onValueChange={(v) => setEditForm({ ...editForm, origin: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{client.name}</h1>
              <Select value={client.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-auto h-7 text-xs border-none p-0">
                  <StatusBadge status={client.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleInviteClient}
              disabled={inviting || !client.email}
            >
              {inviting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Convidar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Excluir
            </Button>
          </div>
        </div>
      )}

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
            <div className="border border-border rounded-lg">
              <EmptyState
                icon={FolderOpen}
                title="Nenhum caso registrado"
                description="Crie o primeiro caso para este cliente."
                actionLabel="Novo caso"
                onAction={() => setCaseDialogOpen(true)}
              />
            </div>
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{client.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}