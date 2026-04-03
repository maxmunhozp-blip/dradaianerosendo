import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import {
  Bug, Lightbulb, Wrench, Loader2, ChevronDown, ChevronUp,
  Clock, Sparkles, Mail, CheckCircle2, Trash2, Send, ImageIcon,
  AlertTriangle,
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug", icon: Bug, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "feature", label: "Feature", icon: Lightbulb, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "ajuste", label: "Ajuste", icon: Wrench, color: "text-muted-foreground bg-muted border-border" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-muted text-muted-foreground" },
  { value: "em_analise", label: "Em análise", color: "bg-amber-100 text-amber-800" },
  { value: "em_desenvolvimento", label: "Em desenvolvimento", color: "bg-blue-100 text-blue-800" },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-800" },
  { value: "recusado", label: "Recusado", color: "bg-red-100 text-red-800" },
];

const PRIORITY_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

export default function AdminSolicitacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [emailing, setEmailing] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-feature-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered = requests.filter((r: any) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  const stats = {
    total: requests.length,
    pendente: requests.filter((r: any) => r.status === "pendente").length,
    em_desenvolvimento: requests.filter((r: any) => r.status === "em_desenvolvimento").length,
    concluido: requests.filter((r: any) => r.status === "concluido").length,
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setSaving(id);
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === "concluido") {
        updateData.tokens_awarded = 10;
      }
      const { error } = await supabase
        .from("feature_requests")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      toast.success(`Status atualizado para "${STATUS_OPTIONS.find(s => s.value === status)?.label}"`);
      queryClient.invalidateQueries({ queryKey: ["admin-feature-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdatePriority = async (id: string, priority: string) => {
    try {
      const { error } = await supabase
        .from("feature_requests")
        .update({ priority, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Prioridade atualizada");
      queryClient.invalidateQueries({ queryKey: ["admin-feature-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
  };

  const handleSaveResponse = async (id: string) => {
    const response = responses[id]?.trim();
    if (!response) { toast.error("Escreva uma resposta"); return; }
    setSaving(id);
    try {
      const { error } = await supabase
        .from("feature_requests")
        .update({ admin_response: response, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Resposta salva");
      queryClient.invalidateQueries({ queryKey: ["admin-feature-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(null);
    }
  };

  const handleSendEmail = async (req: any) => {
    setEmailing(req.id);
    try {
      const statusLabel = STATUS_OPTIONS.find(s => s.value === req.status)?.label || req.status;
      const tokensText = req.status === "concluido" 
        ? `\n\nVocê ganhou 10 tokens de contribuição por nos ajudar a melhorar o sistema! Cada 100 tokens = 5% de desconto na assinatura.`
        : "";
      
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: req.user_email,
          subject: `Atualização da sua solicitação: ${req.title}`,
          html: `
            <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0F172A; font-size: 18px; margin-bottom: 8px;">Atualização da sua solicitação</h2>
              <p style="color: #64748B; font-size: 14px; margin-bottom: 20px;">Olá! Temos novidades sobre a sua solicitação.</p>
              
              <div style="background: #F8FAFC; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="font-size: 13px; color: #64748B; margin: 0 0 4px;">Solicitação</p>
                <p style="font-size: 15px; color: #0F172A; font-weight: 600; margin: 0;">${req.title}</p>
              </div>
              
              <div style="background: #F0FDF4; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="font-size: 13px; color: #64748B; margin: 0 0 4px;">Status atual</p>
                <p style="font-size: 15px; color: #166534; font-weight: 600; margin: 0;">${statusLabel}</p>
              </div>
              
              ${req.admin_response ? `
              <div style="background: #F8FAFC; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="font-size: 13px; color: #64748B; margin: 0 0 4px;">Mensagem da equipe</p>
                <p style="font-size: 14px; color: #0F172A; margin: 0; white-space: pre-wrap;">${req.admin_response}</p>
              </div>
              ` : ""}
              
              <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                Agradecemos imensamente por contribuir com a melhoria do AdvocaciaIA! 
                Sua participação faz toda a diferença para tornar o sistema cada vez melhor.${tokensText}
              </p>
              
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 16px;">
                Se o problema persistir ou se algo não estiver como esperado, 
                você pode enviar uma nova solicitação a qualquer momento.
              </p>
              
              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
              <p style="color: #94A3B8; font-size: 12px;">Equipe AdvocaciaIA</p>
            </div>
          `,
        },
      });
      if (error) throw error;
      toast.success("E-mail enviado para " + req.user_email);
    } catch (err: any) {
      toast.error("Erro ao enviar e-mail: " + (err.message || "desconhecido"));
    } finally {
      setEmailing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta solicitação?")) return;
    try {
      const { error } = await supabase.from("feature_requests").delete().eq("id", id);
      if (error) throw error;
      toast.success("Solicitação excluída");
      queryClient.invalidateQueries({ queryKey: ["admin-feature-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Gerenciar Solicitações</h1>
        <p className="text-sm text-muted-foreground">
          Painel master para gerenciar todas as solicitações dos usuários.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Sparkles, color: "text-primary" },
          { label: "Pendentes", value: stats.pendente, icon: Clock, color: "text-amber-600" },
          { label: "Em dev", value: stats.em_desenvolvimento, icon: Bug, color: "text-blue-600" },
          { label: "Concluídos", value: stats.concluido, icon: CheckCircle2, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nenhuma solicitação" description="Nenhuma solicitação encontrada com esses filtros." />
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const expanded = expandedId === req.id;
            const typeConf = TYPE_OPTIONS.find((t) => t.value === req.type);
            const statusConf = STATUS_OPTIONS.find((s) => s.value === req.status);
            return (
              <Card key={req.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : req.id)}
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {typeConf && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeConf.color}`}>
                          <typeConf.icon className="w-3 h-3 mr-1" />
                          {typeConf.label}
                        </Badge>
                      )}
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusConf?.color || ""}`}>
                        {statusConf?.label || req.status}
                      </Badge>
                      {req.priority && req.priority !== "normal" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {PRIORITY_OPTIONS.find(p => p.value === req.priority)?.label || req.priority}
                        </Badge>
                      )}
                      {req.confirmed_at && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Confirmado
                        </Badge>
                      )}
                      {req.tokens_awarded > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700">
                          +{req.tokens_awarded} tokens
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{req.user_email}</p>
                    </div>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                    {/* Description */}
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Descrição</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{req.description}</p>
                    </div>

                    {req.ai_interpretation && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Interpretação da IA
                        </p>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{req.ai_interpretation}</p>
                      </div>
                    )}

                    {req.image_urls?.length > 0 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Imagens</p>
                        <div className="flex gap-2 flex-wrap">
                          {req.image_urls.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" className="w-24 h-24 rounded border border-border object-cover hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin controls */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Status</p>
                        <Select value={req.status} onValueChange={(v) => handleUpdateStatus(req.id, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Prioridade</p>
                        <Select value={req.priority || "normal"} onValueChange={(v) => handleUpdatePriority(req.id, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Response */}
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Resposta ao usuário</p>
                      <Textarea
                        value={responses[req.id] ?? req.admin_response ?? ""}
                        onChange={(e) => setResponses((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Escreva uma resposta para o usuário..."
                        className="min-h-[80px] text-xs"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => handleSaveResponse(req.id)}
                          disabled={saving === req.id}
                        >
                          {saving === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Salvar resposta
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => handleSendEmail(req)}
                          disabled={emailing === req.id || !req.user_email}
                        >
                          {emailing === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                          Enviar e-mail
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive ml-auto"
                          onClick={() => handleDelete(req.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
