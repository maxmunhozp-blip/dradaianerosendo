import { useState } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Archive,
  Eye,
  Link2,
  Loader2,
  Plus,
  Send,
  X,
  Calendar,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { Link } from "react-router-dom";
import {
  useIntimacoes,
  useUpdateIntimacao,
  useSubmitIntimacao,
  type Intimacao,
} from "@/hooks/use-intimacoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function statusDot(status: string) {
  if (status === "novo") return "bg-amber-500";
  if (status === "vinculado") return "bg-emerald-500";
  if (status === "lido") return "bg-blue-500";
  return "bg-muted-foreground/40";
}

function deadlineBadge(dateStr: string | null) {
  if (!dateStr) return null;
  const now = new Date();
  const deadline = new Date(dateStr);
  const hours = differenceInHours(deadline, now);
  const days = differenceInDays(deadline, now);

  if (hours < 0) return <Badge variant="destructive" className="text-[10px]">Vencido</Badge>;
  if (hours <= 48) return (
    <Badge variant="destructive" className="text-[10px] animate-pulse gap-1">
      <AlertTriangle className="w-3 h-3" />
      URGENTE {hours}h
    </Badge>
  );
  if (days <= 5) return <Badge variant="destructive" className="text-[10px]">{days}d</Badge>;
  if (days <= 15) return <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">{days}d</Badge>;
  return <Badge variant="outline" className="text-[10px]">{days}d</Badge>;
}

export default function Intimacoes() {
  const [tab, setTab] = useState("todas");
  const statusFilter = tab === "todas" ? undefined : tab === "novas" ? "novo" : tab === "vinculadas" ? "vinculado" : "arquivado";
  const { data: intimacoes = [], isLoading } = useIntimacoes(statusFilter);
  const updateMutation = useUpdateIntimacao();
  const submitMutation = useSubmitIntimacao();

  const [selectedIntimacao, setSelectedIntimacao] = useState<Intimacao | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ subject: "", body: "", from_email: "", date: "" });
  const [linkingId, setLinkingId] = useState<string | null>(null);

  // Cases for linking
  const { data: allCases = [] } = useQuery({
    queryKey: ["cases-for-link"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("id, case_type, clients(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleArchive = (id: string) => {
    updateMutation.mutate({ id, status: "arquivado" }, {
      onSuccess: () => toast.success("Intimação arquivada"),
    });
  };

  const handleLink = (intimacaoId: string, caseId: string) => {
    updateMutation.mutate({ id: intimacaoId, case_id: caseId, status: "vinculado" }, {
      onSuccess: () => {
        toast.success("Intimação vinculada ao caso");
        setLinkingId(null);
      },
    });
  };

  const handleSubmitManual = () => {
    if (!formData.subject && !formData.body) {
      toast.error("Preencha o assunto ou corpo do e-mail");
      return;
    }
    submitMutation.mutate(formData, {
      onSuccess: (data) => {
        toast.success("Intimação processada com sucesso!");
        setShowForm(false);
        setFormData({ subject: "", body: "", from_email: "", date: "" });
      },
      onError: (err: any) => toast.error("Erro: " + err.message),
    });
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Intimações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoramento de notificações judiciais
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Registrar manualmente
          </Button>
          <Button size="sm" asChild>
            <Link to="/settings">
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              Configurar webhook
            </Link>
          </Button>
        </div>
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="border border-border rounded-lg p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Registrar intimação manualmente</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Assunto do e-mail</Label>
              <Input placeholder="Ex: Intimação — Proc. 1234567-89.2024..." value={formData.subject} onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remetente</Label>
              <Input placeholder="Ex: noreply@tjsp.jus.br" value={formData.from_email} onChange={(e) => setFormData((p) => ({ ...p, from_email: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corpo do e-mail</Label>
            <Textarea rows={6} placeholder="Cole o conteúdo completo do e-mail judicial aqui..." value={formData.body} onChange={(e) => setFormData((p) => ({ ...p, body: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1 w-48">
              <Label className="text-xs">Data do e-mail</Label>
              <Input type="datetime-local" value={formData.date} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <Button onClick={handleSubmitManual} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Processar com IA
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="novas">Novas</TabsTrigger>
          <TabsTrigger value="vinculadas">Vinculadas</TabsTrigger>
          <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <div className="border border-border rounded-lg divide-y divide-border mt-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-32 mt-1.5" />
                </div>
              ))
            ) : intimacoes.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma intimação encontrada</p>
              </div>
            ) : (
              intimacoes.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(item.status)}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.process_number || "Processo não identificado"}
                        </p>
                        {item.tribunal && (
                          <Badge variant="outline" className="text-[10px] shrink-0">{item.tribunal}</Badge>
                        )}
                        {deadlineBadge(item.deadline_date)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.movement_type || "Movimentação"} — {item.cases ? `${item.cases.case_type} — ${item.cases.clients?.name}` : "Não vinculado"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.raw_email_date ? format(new Date(item.raw_email_date), "dd/MM/yyyy HH:mm") : format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                        {item.from_email && ` — ${item.from_email}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIntimacao(item)}>
                      <Eye className="w-3 h-3 mr-1" />
                      Detalhes
                    </Button>
                    {linkingId === item.id ? (
                      <Select onValueChange={(val) => handleLink(item.id, val)}>
                        <SelectTrigger className="h-7 w-40 text-xs">
                          <SelectValue placeholder="Selecione o caso" />
                        </SelectTrigger>
                        <SelectContent>
                          {allCases.map((c: any) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.case_type} — {c.clients?.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLinkingId(item.id)}>
                        <Link2 className="w-3 h-3 mr-1" />
                        Vincular
                      </Button>
                    )}
                    {item.status !== "arquivado" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleArchive(item.id)}>
                        <Archive className="w-3 h-3 mr-1" />
                        Arquivar
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <Sheet open={!!selectedIntimacao} onOpenChange={(open) => !open && setSelectedIntimacao(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedIntimacao && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">
                  {selectedIntimacao.movement_type || "Intimação"}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Processo</Label>
                  <p className="text-sm font-medium">{selectedIntimacao.process_number || "Não identificado"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tribunal</Label>
                    <p className="text-sm">{selectedIntimacao.tribunal || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <p className="text-sm">{selectedIntimacao.movement_type || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Prazo</Label>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{selectedIntimacao.deadline_date ? format(new Date(selectedIntimacao.deadline_date), "dd/MM/yyyy") : "—"}</p>
                      {deadlineBadge(selectedIntimacao.deadline_date)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge className={`text-xs ${statusDot(selectedIntimacao.status)} text-white`}>
                      {selectedIntimacao.status}
                    </Badge>
                  </div>
                </div>
                {selectedIntimacao.cases && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Caso vinculado</Label>
                    <Link to={`/cases/${selectedIntimacao.case_id}`} className="text-sm text-primary hover:underline">
                      {selectedIntimacao.cases.case_type} — {selectedIntimacao.cases.clients?.name}
                    </Link>
                  </div>
                )}
                {selectedIntimacao.ai_summary && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Resumo da IA</Label>
                    <p className="text-sm bg-muted/50 rounded-md p-3">{selectedIntimacao.ai_summary}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Assunto original</Label>
                  <p className="text-sm">{selectedIntimacao.raw_email_subject || "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Corpo do e-mail</Label>
                  <div className="text-xs bg-muted/50 rounded-md p-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                    {selectedIntimacao.raw_email_body || "—"}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {selectedIntimacao.status === "novo" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      updateMutation.mutate({ id: selectedIntimacao.id, status: "lido" });
                      setSelectedIntimacao({ ...selectedIntimacao, status: "lido" });
                    }}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Marcar como lido
                    </Button>
                  )}
                  {selectedIntimacao.status !== "arquivado" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      handleArchive(selectedIntimacao.id);
                      setSelectedIntimacao(null);
                    }}>
                      <Archive className="w-3 h-3 mr-1" />
                      Arquivar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
