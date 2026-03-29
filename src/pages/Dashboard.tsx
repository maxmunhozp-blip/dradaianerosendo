import { Users, FolderOpen, FileText, TrendingUp, Plus, Bot, MessageSquare, CalendarDays, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { EmptyState } from "@/components/EmptyState";
import { StatCardSkeleton } from "@/components/Skeletons";
import { Link } from "react-router-dom";
import { useClients } from "@/hooks/use-clients";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUpcomingHearings } from "@/hooks/use-hearings";
import { format, differenceInHours } from "date-fns";

export default function Dashboard() {
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["cases-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*, clients(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ["documents-all-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("status", "solicitado");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = clientsLoading || casesLoading || docsLoading;

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
            <Link to="/lara?cmd=/cobrar">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Cobrar documentos
            </Link>
          </Button>
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
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat) => (
              <div key={stat.label} className="border border-border rounded-lg p-4 hover:border-t-amber-500 hover:border-t-2 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-semibold text-foreground tabular-nums">
                  <AnimatedCounter value={stat.value} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
      </div>

      <div>
        <h2 className="text-sm font-medium text-foreground mb-4">Casos recentes</h2>
        <div className="border border-border rounded-lg divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            ))
          ) : recentCases.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Nenhum caso cadastrado"
              description="Crie o primeiro caso para começar a organizar seus processos."
              actionLabel="Criar caso (Cmd+K)"
            />
          ) : (
            recentCases.map((c: any) => (
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
            ))
          )}
        </div>
      </div>

      {/* Upcoming hearings */}
      <UpcomingHearings />
    </div>
  );
}

function UpcomingHearings() {
  const { data: hearings = [], isLoading } = useUpcomingHearings(5);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground">Próximas audiências</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/agenda">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
            Ver agenda
          </Link>
        </Button>
      </div>
      <div className="border border-border rounded-lg divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24 mt-1.5" />
            </div>
          ))
        ) : hearings.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <CalendarDays className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma audiência agendada</p>
          </div>
        ) : (
          hearings.map((h: any) => {
            const d = new Date(h.date);
            const hoursUntil = differenceInHours(d, new Date());
            const isSoon = hoursUntil >= 0 && hoursUntil <= 48;
            return (
              <Link key={h.id} to={`/cases/${h.case_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-center shrink-0 w-10">
                    <p className="text-lg font-semibold text-foreground tabular-nums">{format(d, "dd")}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{format(d, "MMM")}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.cases?.case_type} — {h.cases?.clients?.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{format(d, "HH:mm")}
                      </span>
                      {h.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{h.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isSoon && (
                  <Badge variant="destructive" className="text-[10px]">
                    {hoursUntil <= 24 ? "Hoje" : "Amanhã"}
                  </Badge>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
