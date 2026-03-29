import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Save,
  MessageSquare,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Building2,
  Clock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ALL_KEYS = [
  "zapi_instance_id",
  "zapi_token",
  "office_name",
  "office_oab",
  "office_address",
  "office_phone",
  "office_email",
  "template_doc_reminder",
  "template_welcome",
  "template_signing",
  "hours_weekday_start",
  "hours_weekday_end",
  "hours_saturday_start",
  "hours_saturday_end",
  "hours_sunday",
];

function CollapsibleSection({
  open,
  onOpenChange,
  icon: Icon,
  iconBg,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  icon: any;
  iconBg: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">{title}</CardTitle>
                  <CardDescription className="text-xs">{description}</CardDescription>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const VALIDATORS: Record<string, { regex: RegExp; msg: string }> = {
  office_phone: {
    regex: /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/,
    msg: "Formato inválido. Ex: (11) 99999-9999",
  },
  office_email: {
    regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    msg: "E-mail inválido. Ex: contato@escritorio.com",
  },
  office_oab: {
    regex: /^OAB\/[A-Z]{2}\s?\d{3,6}$/i,
    msg: "Formato inválido. Ex: OAB/SP 123456",
  },
};

export default function Settings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState({
    office: true,
    zapi: false,
    templates: false,
    hours: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const val = (key: string) => values[key] || "";
  const set = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    // Clear error on edit
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const [key, validator] of Object.entries(VALIDATORS)) {
      const v = values[key]?.trim();
      if (v && !validator.regex.test(v)) {
        newErrors[key] = validator.msg;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = (await supabase
      .from("settings" as any)
      .select("key, value")
      .in("key", ALL_KEYS)) as any;

    if (data) {
      const map: Record<string, string> = {};
      for (const row of data) map[row.key] = row.value;
      setValues(map);
    }
    setLoading(false);
  };

  const saveAll = async () => {
    if (!validate()) {
      toast.error("Corrija os campos destacados antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const entries = Object.entries(values).filter(([_, v]) => v.trim() !== "");
      for (const [key, value] of entries) {
        const { error } = await (supabase.from("settings" as any) as any).upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
        if (error) throw error;
      }
      setSaved(true);
      toast.success("Configurações salvas com sucesso!");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os dados do escritório, integrações e preferências.
          </p>
        </div>
        <Button onClick={saveAll} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar tudo"}
        </Button>
      </div>

      {/* Dados do Escritório */}
      <CollapsibleSection
        open={openSections.office}
        onOpenChange={() => toggle("office")}
        icon={Building2}
        iconBg="bg-primary/10 text-primary"
        title="Dados do Escritório"
        description="Informações usadas nos documentos e comunicações"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label className="text-xs">Nome do escritório / Advogada</Label>
            <Input
              placeholder="Dra. Daiane Rosendo"
              value={val("office_name")}
              onChange={(e) => set("office_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">OAB</Label>
            <Input
              placeholder="OAB/SP 123456"
              value={val("office_oab")}
              onChange={(e) => set("office_oab", e.target.value)}
              className={errors.office_oab ? "border-destructive" : ""}
            />
            {errors.office_oab && (
              <p className="text-[10px] text-destructive">{errors.office_oab}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Telefone</Label>
            <Input
              placeholder="(11) 99999-9999"
              value={val("office_phone")}
              onChange={(e) => set("office_phone", e.target.value)}
              className={errors.office_phone ? "border-destructive" : ""}
            />
            {errors.office_phone && (
              <p className="text-[10px] text-destructive">{errors.office_phone}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">E-mail</Label>
            <Input
              placeholder="contato@escritorio.com"
              value={val("office_email")}
              onChange={(e) => set("office_email", e.target.value)}
              className={errors.office_email ? "border-destructive" : ""}
            />
            {errors.office_email && (
              <p className="text-[10px] text-destructive">{errors.office_email}</p>
            )}
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="text-xs">Endereço</Label>
            <Input
              placeholder="Rua ..., nº ..., Cidade - UF"
              value={val("office_address")}
              onChange={(e) => set("office_address", e.target.value)}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Z-API */}
      <CollapsibleSection
        open={openSections.zapi}
        onOpenChange={() => toggle("zapi")}
        icon={MessageSquare}
        iconBg="bg-accent/20 text-accent-foreground"
        title="Z-API (WhatsApp)"
        description="Configure sua instância para envio de mensagens via WhatsApp"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Instance ID</Label>
            <Input
              placeholder="Ex: 3C7B2A1D4E5F..."
              value={val("zapi_instance_id")}
              onChange={(e) => set("zapi_instance_id", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Token</Label>
            <Input
              type="password"
              placeholder="Seu token Z-API"
              value={val("zapi_token")}
              onChange={(e) => set("zapi_token", e.target.value)}
            />
          </div>
          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como obter suas credenciais:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Acesse <span className="font-medium">z-api.io</span> e faça login</li>
              <li>Crie ou selecione uma instância</li>
              <li>Copie o <strong>Instance ID</strong> e o <strong>Token</strong></li>
              <li>Cole nos campos acima e salve</li>
            </ol>
          </div>
        </div>
      </CollapsibleSection>

      {/* Templates de Mensagem */}
      <CollapsibleSection
        open={openSections.templates}
        onOpenChange={() => toggle("templates")}
        icon={FileText}
        iconBg="bg-secondary text-secondary-foreground"
        title="Templates de Mensagem"
        description="Modelos de texto para WhatsApp e comunicações"
      >
        <div className="space-y-4">
          <TemplateField
            label="Cobrança de documentos"
            placeholder={"Olá {nome}! Tudo bem?\n\nSou a Dra. Daiane Rosendo. Passando para lembrar que ainda precisamos dos seguintes documentos:\n\n{documentos}\n\nQualquer dúvida estou à disposição!"}
            value={val("template_doc_reminder")}
            onChange={(v) => set("template_doc_reminder", v)}
            variables={[
              { tag: "{nome}", desc: "Nome do cliente" },
              { tag: "{documentos}", desc: "Lista de docs pendentes" },
              { tag: "{tipo_caso}", desc: "Tipo do caso" },
            ]}
          />
          <TemplateField
            label="Boas-vindas ao portal"
            placeholder={"Olá {nome}! Bem-vindo(a) ao nosso portal.\n\nAcesse pelo link abaixo para acompanhar seu processo:\n{link_portal}"}
            value={val("template_welcome")}
            onChange={(v) => set("template_welcome", v)}
            variables={[
              { tag: "{nome}", desc: "Nome do cliente" },
              { tag: "{link_portal}", desc: "Link do portal" },
            ]}
          />
          <TemplateField
            label="Solicitação de assinatura"
            placeholder={"Olá {nome}! Segue o link para assinatura dos documentos:\n{link_assinatura}\n\nQualquer dúvida, estou à disposição."}
            value={val("template_signing")}
            onChange={(v) => set("template_signing", v)}
            variables={[
              { tag: "{nome}", desc: "Nome do cliente" },
              { tag: "{link_assinatura}", desc: "Link de assinatura" },
            ]}
          />
        </div>
      </CollapsibleSection>

      {/* Horário de Atendimento */}
      <CollapsibleSection
        open={openSections.hours}
        onOpenChange={() => toggle("hours")}
        icon={Clock}
        iconBg="bg-muted text-muted-foreground"
        title="Horário de Atendimento"
        description="Horários exibidos no portal e nas comunicações"
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Segunda a Sexta</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="time"
                className="w-32"
                value={val("hours_weekday_start")}
                onChange={(e) => set("hours_weekday_start", e.target.value)}
              />
              <span className="text-xs text-muted-foreground">às</span>
              <Input
                type="time"
                className="w-32"
                value={val("hours_weekday_end")}
                onChange={(e) => set("hours_weekday_end", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Sábado</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="time"
                className="w-32"
                value={val("hours_saturday_start")}
                onChange={(e) => set("hours_saturday_start", e.target.value)}
              />
              <span className="text-xs text-muted-foreground">às</span>
              <Input
                type="time"
                className="w-32"
                value={val("hours_saturday_end")}
                onChange={(e) => set("hours_saturday_end", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Domingo</Label>
            <Input
              placeholder="Fechado"
              value={val("hours_sunday")}
              onChange={(e) => set("hours_sunday", e.target.value)}
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
