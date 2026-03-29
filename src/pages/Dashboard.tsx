import { Users, FolderOpen, FileText, TrendingUp, Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { useClients } from "@/hooks/use-clients";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { data: clients = [] } = useClients();
  const { data: cases = [] } = useQuery({
    queryKey: ["cases-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*, clients(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["documents-all-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("status", "solicitado");
      if (error) throw error;
      return data;
    },
  });

  const activeClients = clients.filter((c) => c.status === "ativo").length;
  const casesInProgress = cases.filter((c) => c.status !== "encerrado").length;
  const pendingDocs = docs.length;
  const now = new Date();
  const casesThisMonth = cases.filter((c) => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { label: "Clientes ativos", value: activeClients, icon: Users },
    { label: "Casos em andamento", value: casesInProgress, icon: FolderOpen },
    { label: "Docs. pendentes", value: pendingDocs, icon: FileText },
    { label: "Casos este mês", value: casesThisMonth, icon: TrendingUp },
  ];

  const recentCases = cases.slice(0, 5);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Painel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do escritório</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/clients">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Novo cliente
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/lara">
              <Bot className="w-3.5 h-3.5 mr-1.5" />
              Abrir LARA
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-medium text-foreground mb-4">Casos recentes</h2>
        <div className="border border-border rounded-lg divide-y divide-border">
          {recentCases.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">Nenhum caso cadastrado.</p>
          )}
          {recentCases.map((c: any) => (
            <Link
              key={c.id}
              to={`/cases/${c.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-sm text-foreground font-medium">
                  {c.case_type} — {c.clients?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
