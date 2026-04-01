import { Users, Plus, Bot, CalendarDays, Clock, MapPin, Bell, AlertTriangle, RefreshCw, PenLine, CheckCircle2, Clock4, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Link } from "react-router-dom";
import { useClients } from "@/hooks/use-clients";
import { useOwnerFilter } from "@/hooks/use-owner-filter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUpcomingHearings } from "@/hooks/use-hearings";
import { useUrgentIntimacoes } from "@/hooks/use-intimacoes";
import { useSyncGmail } from "@/components/EmailAccountsSection";
import { format, differenceInHours, differenceInDays } from "date-fns";

function SyncEmailsButton() {
  const syncMutation = useSyncGmail();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={syncMutation.isPending}
      onClick={() => syncMutation.mutate(undefined)}
    >
      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
      Sincronizar e-mails
    </Button>
  );
}

export default function Dashboard() {
  const { ownerFilter } = useOwnerFilter();
  const { data: clients = [], isLoading: clientsLoading } = useClients();

  const isLoading = clientsLoading;

  const activeClients = clients.filter((c) => c.status === "ativo").length;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Painel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do escritório</p>
        </div>
        <div className="flex gap-2">
          <SyncEmailsButton />
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

      {/* Upcoming hearings */}
      <UpcomingHearings />

      <div className="grid grid-cols-1 gap-4 mt-8 mb-8">
        <div className="border border-border rounded-lg p-4 hover:border-t-amber-500 hover:border-t-2 transition-all">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-semibold text-foreground tabular-nums">
            {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : <AnimatedCounter value={activeClients} />}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Clientes ativos</p>
        </div>
      </div>

      {/* Signature status */}
      <SignaturePanel ownerFilter={ownerFilter} />

      {/* Urgent intimacoes */}
      <UrgentIntimacoes />
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

function UrgentIntimacoes() {
  const { data: intimacoes = [], isLoading } = useUrgentIntimacoes(7);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground">Intimações urgentes</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/intimacoes">
            <Bell className="w-3.5 h-3.5 mr-1.5" />
            Ver todas
          </Link>
        </Button>
      </div>
      <div className="border border-border rounded-lg divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24 mt-1.5" />
            </div>
          ))
        ) : intimacoes.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <AlertTriangle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma intimação com prazo urgente</p>
          </div>
        ) : (
          intimacoes.map((item: any) => {
            const days = item.deadline_date ? differenceInDays(new Date(item.deadline_date), new Date()) : null;
            return (
              <Link key={item.id} to="/intimacoes" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.process_number || "Processo não identificado"} — {item.movement_type || "Movimentação"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.tribunal || ""} {item.cases ? `— ${item.cases.case_type} — ${item.cases.clients?.name}` : ""}
                  </p>
                </div>
                {days !== null && (
                  <Badge variant={days <= 3 ? "destructive" : "outline"} className="text-[10px]">
                    {days <= 0 ? "Vencido" : `${days}d restantes`}
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

function SignaturePanel({ ownerFilter }: { ownerFilter: string | null }) {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["signature-docs-dashboard", ownerFilter],
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, name, signature_status, signature_requested_at, signature_completed_at, case_id, cases(case_type, clients(name))")
        .in("signature_status", ["sent", "signed", "rejected"])
        .order("signature_requested_at", { ascending: false })
        .limit(10);
      if (ownerFilter) q = q.eq("owner_id", ownerFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const pending = docs.filter((d: any) => d.signature_status === "sent");
  const completed = docs.filter((d: any) => d.signature_status === "signed");
  const rejected = docs.filter((d: any) => d.signature_status === "rejected");

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground">Assinaturas digitais</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock4 className="w-3 h-3 text-amber-500" />{pending.length} pendente{pending.length !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{completed.length} assinado{completed.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="border border-border rounded-lg divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24 mt-1.5" />
            </div>
          ))
        ) : docs.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <PenLine className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum documento enviado para assinatura</p>
          </div>
        ) : (
          docs.map((d: any) => {
            const statusMap: Record<string, { label: string; variant: "outline" | "destructive"; color: string }> = {
              sent: { label: "Aguardando", variant: "outline", color: "border-amber-300 text-amber-600 bg-amber-50" },
              signed: { label: "Assinado", variant: "outline", color: "border-emerald-300 text-emerald-600 bg-emerald-50" },
              rejected: { label: "Recusado", variant: "destructive", color: "" },
            };
            const s = statusMap[d.signature_status] || statusMap.sent;
            return (
              <Link key={d.id} to={`/cases/${d.case_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-xs">{d.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(d as any).cases?.case_type} — {(d as any).cases?.clients?.name}
                    {d.signature_requested_at && ` · Enviado ${format(new Date(d.signature_requested_at), "dd/MM/yyyy")}`}
                  </p>
                </div>
                <Badge variant={s.variant} className={`text-[10px] ${s.color}`}>
                  {s.label}
                </Badge>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
