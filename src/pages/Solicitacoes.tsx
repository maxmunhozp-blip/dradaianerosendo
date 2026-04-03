import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import {
  Sparkles, Bug, Lightbulb, Wrench, Loader2, Upload, X, Copy,
  ChevronDown, ChevronUp, Brain, Send, ImageIcon, Clock,
  CheckCircle2, Trophy, Star, ThumbsUp,
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug (problema)", icon: Bug, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "feature", label: "Funcionalidade", icon: Lightbulb, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "ajuste", label: "Ajuste (melhoria)", icon: Wrench, color: "text-muted-foreground bg-muted border-border" },
];

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_analise: "bg-amber-100 text-amber-800",
  em_desenvolvimento: "bg-blue-100 text-blue-800",
  concluido: "bg-green-100 text-green-800",
  recusado: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  em_desenvolvimento: "Em desenvolvimento",
  concluido: "Concluído",
  recusado: "Recusado",
};

const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  critica: "Crítica",
};

interface AiResult {
  interpretation: string;
  module: string;
  priority: string;
  acceptance_criteria: string[];
}

export default function Solicitacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [type, setType] = useState("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["feature-requests"],
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

  const totalTokens = requests.reduce((sum: number, r: any) => sum + (r.tokens_awarded || 0), 0);
  const confirmedCount = requests.filter((r: any) => r.confirmed_at).length;
  const discountPercent = Math.floor(totalTokens / 100) * 5;

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - images.length;
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) toast.error("Máximo de 3 imagens");
    setImages((prev) => [...prev, ...toAdd]);
    toAdd.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleInterpret = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Preencha o título e a descrição antes de interpretar");
      return;
    }
    setInterpreting(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("interpret-request", {
        body: { title, description, type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiResult(data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao interpretar solicitação");
    } finally {
      setInterpreting(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Preencha título e descrição");
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      for (const file of images) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("request-images").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("request-images").getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from("feature_requests").insert({
        user_id: user.id,
        user_email: user.email,
        type,
        title: title.trim(),
        description: description.trim(),
        ai_interpretation: aiResult?.interpretation || null,
        image_urls: imageUrls,
        priority: aiResult?.priority || "normal",
      });
      if (error) throw error;

      toast.success("Solicitação enviada com sucesso!");
      setTitle("");
      setDescription("");
      setType("feature");
      setImages([]);
      setImagePreviews([]);
      setAiResult(null);
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (id: string) => {
    setConfirming(id);
    try {
      const { error } = await supabase
        .from("feature_requests")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Correção confirmada! Obrigado pela contribuição.");
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar");
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Solicitações</h1>
        <p className="text-sm text-muted-foreground">
          Envie pedidos de funcionalidades, ajustes ou reporte bugs.
        </p>
      </div>

      {/* Gamification card */}
      {totalTokens > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Suas contribuições</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700">
                  <Star className="w-3 h-3 mr-0.5" />
                  {totalTokens} tokens
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {confirmedCount} {confirmedCount === 1 ? "correção confirmada" : "correções confirmadas"}
                {discountPercent > 0 && (
                  <span className="text-amber-700 font-medium"> — {discountPercent}% de desconto desbloqueado</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Nova solicitação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Botão de assinatura não funciona"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema, funcionalidade ou ajuste desejado..."
              className="min-h-[120px]"
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label className="text-xs">Imagens (até 3)</Label>
            <div className="flex gap-2 flex-wrap">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded border border-border overflow-hidden group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {images.length < 3 && (
                <label className="w-20 h-20 rounded border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground mt-1">Adicionar</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleImageAdd}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleInterpret}
              disabled={interpreting || !title.trim() || !description.trim()}
              className="gap-1.5"
            >
              {interpreting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              Interpretar com IA
            </Button>
          </div>

          {aiResult && (
            <Card className="bg-muted/30 border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  Análise da IA
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Módulo:</span>{" "}
                    <span className="font-medium">{aiResult.module}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prioridade:</span>{" "}
                    <span className="font-medium">{PRIORITY_LABELS[aiResult.priority] || aiResult.priority}</span>
                  </div>
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Descrição melhorada:</p>
                  <p className="text-foreground leading-relaxed">{aiResult.interpretation}</p>
                </div>
                {aiResult.acceptance_criteria?.length > 0 && (
                  <div className="text-xs">
                    <p className="text-muted-foreground mb-1">Critérios de aceite:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-foreground">
                      {aiResult.acceptance_criteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => {
                    setDescription(aiResult.interpretation);
                    toast.success("Descrição atualizada");
                  }}
                >
                  <Copy className="w-3 h-3" />
                  Usar esta descrição
                </Button>
              </CardContent>
            </Card>
          )}

          <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !description.trim()} className="gap-1.5 w-full">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar Solicitação
          </Button>
        </CardContent>
      </Card>

      {/* Requests list */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Minhas solicitações</h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Nenhuma solicitação ainda"
            description="Use o formulário acima para enviar sua primeira solicitação."
          />
        ) : (
          requests.map((req: any) => {
            const expanded = expandedId === req.id;
            const typeConf = TYPE_OPTIONS.find((t) => t.value === req.type);
            const isConcluido = req.status === "concluido";
            const isConfirmed = !!req.confirmed_at;
            return (
              <Card key={req.id} className={`overflow-hidden ${isConfirmed ? "border-green-200" : ""}`}>
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
                      <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[req.status] || ""}`}>
                        {STATUS_LABELS[req.status] || req.status}
                      </Badge>
                      {req.priority && req.priority !== "normal" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {PRIORITY_LABELS[req.priority] || req.priority}
                        </Badge>
                      )}
                      {isConfirmed && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" />
                          Confirmado
                        </Badge>
                      )}
                      {req.tokens_awarded > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700">
                          <Star className="w-3 h-3 mr-0.5" />
                          +{req.tokens_awarded}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(req.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
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
                              <img src={url} alt="" className="w-20 h-20 rounded border border-border object-cover hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {req.admin_response && (
                      <div className="bg-muted/50 rounded p-3">
                        <p className="text-[11px] text-muted-foreground mb-0.5">Resposta da equipe</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{req.admin_response}</p>
                      </div>
                    )}

                    {/* Confirm fix button */}
                    {isConcluido && !isConfirmed && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-green-800 mb-2">
                          Esta solicitação foi marcada como concluída. Confirme se tudo está funcionando como esperado.
                        </p>
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs h-7 bg-green-600 hover:bg-green-700"
                          onClick={() => handleConfirm(req.id)}
                          disabled={confirming === req.id}
                        >
                          {confirming === req.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ThumbsUp className="w-3 h-3" />
                          )}
                          Confirmar correção
                        </Button>
                      </div>
                    )}

                    {isConfirmed && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-xs font-medium text-green-800">Correção confirmada</p>
                          <p className="text-[11px] text-green-600">
                            Confirmado em {new Date(req.confirmed_at).toLocaleDateString("pt-BR")}
                            {req.tokens_awarded > 0 && ` — +${req.tokens_awarded} tokens ganhos`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
