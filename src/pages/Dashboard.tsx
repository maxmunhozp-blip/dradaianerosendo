import { Users, FolderOpen, FileText, TrendingUp, Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockClients, mockCases, mockDocuments } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const activeClients = mockClients.filter((c) => c.status === "ativo").length;
  const casesInProgress = mockCases.filter((c) => c.status !== "encerrado").length;
  const pendingDocs = mockDocuments.filter((d) => d.status === "solicitado").length;
  const casesThisMonth = mockCases.filter((c) => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { label: "Clientes ativos", value: activeClients, icon: Users },
    { label: "Casos em andamento", value: casesInProgress, icon: FolderOpen },
    { label: "Docs. pendentes", value: pendingDocs, icon: FileText },
    { label: "Casos este mês", value: casesThisMonth, icon: TrendingUp },
  ];

  const recentActivity = [
    { text: "Documento recebido: RG - Maria Silva", time: "Há 2 horas", case: "Divórcio" },
    { text: "Novo caso aberto: Guarda - João Pedro", time: "Há 5 horas", case: "Guarda" },
    { text: "Petição protocolada: Caso #cs1", time: "Ontem", case: "Divórcio" },
    { text: "Novo cliente cadastrado: Ana Carolina", time: "Ontem", case: null },
    { text: "Checklist atualizado: Inventário - Roberto", time: "Há 2 dias", case: "Inventário" },
  ];

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
        <h2 className="text-sm font-medium text-foreground mb-4">Atividade recente</h2>
        <div className="border border-border rounded-lg divide-y divide-border">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1">
                <p className="text-sm text-foreground">{item.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
              </div>
              {item.case && <StatusBadge status="andamento" className="ml-4" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
