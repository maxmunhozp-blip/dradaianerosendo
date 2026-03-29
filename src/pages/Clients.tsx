import { useState } from "react";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeletons";
import { Search, Plus, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();

  const { data: allCases = [] } = useQuery({
    queryKey: ["cases-all-for-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("client_id, case_type");
      if (error) throw error;
      return data;
    },
  });

  const casesByClient = allCases.reduce<Record<string, string>>((acc, c) => {
    if (!acc[c.client_id]) acc[c.client_id] = c.case_type;
    return acc;
  }, {});

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    origin: "",
    status: "prospect",
  });

  const filtered = clients.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.cpf || "").includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      await createClient.mutateAsync(form);
      toast.success("Cliente cadastrado com sucesso");
      setDialogOpen(false);
      setForm({ name: "", cpf: "", phone: "", email: "", origin: "", status: "prospect" });
    } catch {
      toast.error("Erro ao cadastrar cliente");
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients.length} clientes cadastrados
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome do cliente"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      const masked = digits
                        .replace(/(\d{3})(\d)/, "$1.$2")
                        .replace(/(\d{3})(\d)/, "$1.$2")
                        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                      setForm({ ...form, cpf: masked });
                    }}
                    placeholder="000.000.000-00"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Origem</Label>
                  <Select value={form.origin} onValueChange={(v) => setForm({ ...form, origin: v })}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="Indicação">Indicação</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="contrato">Contrato</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createClient.isPending}>
                {createClient.isPending ? "Cadastrando..." : "Cadastrar cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="contrato">Contrato</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filtered.length === 0 && clients.length === 0 ? (
        <div className="border border-border rounded-lg">
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado"
            description="Cadastre seu primeiro cliente para começar a gerenciar seus casos."
            actionLabel="Cadastrar cliente"
            onAction={() => setDialogOpen(true)}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg">
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
            description="Nenhum cliente encontrado com os filtros aplicados."
          />
        </div>
      ) : (
        <div className="border border-border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Tipo de caso</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Origem</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Cadastro</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link to={`/clients/${client.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {client.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{client.cpf}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{casesByClient[client.id] || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={client.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{client.origin || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(client.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/clients/${client.id}`}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
