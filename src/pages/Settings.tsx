import { useState, useEffect, useRef, type ReactNode } from "react";
import { PenLine, Eye, EyeOff } from "lucide-react";
import {
  Save,
  MessageSquare,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Building2,
  Clock,
  FileText,
  Bell,
  Copy,
  Mail,
  History,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Scale,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
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
import EmailAccountsSection from "@/components/EmailAccountsSection";

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
  "signature_api_token",
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

function TemplateField({
  label,
  placeholder,
  value,
  onChange,
  variables,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  variables: { tag: string; desc: string }[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (tag: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value + tag);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = value.substring(0, start) + tag + value.substring(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + tag.length;
    });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Textarea
        ref={textareaRef}
        rows={5}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground mr-1">Variáveis:</span>
        {variables.map((v) => (
          <Badge
            key={v.tag}
            variant="outline"
            className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors font-mono"
            title={`${v.desc} — clique para inserir`}
            onClick={() => insertVariable(v.tag)}
          >
            {v.tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function SyncLogSection({ open, onOpenChange }: { open: boolean; onOpenChange: () => void }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadAccounts();
  }, [open]);

  const loadAccounts = async () => {
    setLoading(true);
    const { data } = await (supabase.from("email_accounts") as any)
      .select("id, label, email, provider, status, last_sync")
      .order("last_sync", { ascending: false, nullsFirst: false });
    setAccounts(data || []);
    setLoading(false);
  };

  const statusIcon = (status: string) => {
    if (status === "conectado") return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    if (status === "erro") return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
  };

  return (
    <CollapsibleSection
      open={open}
      onOpenChange={onOpenChange}
      icon={History}
      iconBg="bg-primary/10 text-primary"
      title="Histórico de Sincronização"
      description="Log das últimas sincronizações automáticas de e-mail"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Cron jobs rodam a cada 15 minutos (Gmail + IMAP)
          </p>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={loadAccounts} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {loading && accounts.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma conta de e-mail cadastrada.
          </p>
        ) : (
          <div className="border rounded-lg divide-y">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center gap-3 px-3 py-2.5">
                {statusIcon(acc.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{acc.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{acc.email}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {acc.provider === "gmail" ? "Gmail" : "IMAP"}
                </Badge>
                <div className="text-right shrink-0">
                  {acc.last_sync ? (
                    <div>
                      <p className="text-[11px] font-medium text-foreground">
                        {format(new Date(acc.last_sync), "dd/MM/yyyy")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(acc.last_sync), "HH:mm:ss")}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Nunca sincronizado</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-muted/50 rounded-md p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground text-xs">Cron jobs ativos:</p>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
            <span><code className="bg-background px-1 rounded">sync-gmail-every-15min</code> — Sincroniza contas Gmail via OAuth</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
            <span><code className="bg-background px-1 rounded">sync-imap-every-15min</code> — Sincroniza contas Hostinger/IMAP</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
            <span><code className="bg-background px-1 rounded">check-urgent-deadlines-every-15min</code> — Alerta WhatsApp para prazos &lt;48h</span>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
function SignatureSettings({ value, onChange, onSave }: { value: string; onChange: (v: string) => void; onSave: () => Promise<void> }) {
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingToken, setSavingToken] = useState(false);

  const saveToken = async () => {
    if (!value.trim()) {
      toast.error("Insira o token antes de salvar.");
      return;
    }
    setSavingToken(true);
    try {
      await onSave();
      toast.success("Token ZapSign salvo com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar token ZapSign.");
    } finally {
      setSavingToken(false);
    }
  };

  const testConnection = async () => {
    if (!value) {
      toast.error("Insira o token antes de testar.");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-zapsign", {
        body: { token: value },
      });
      if (error) {
        toast.error(error.message || "Erro ao conectar com ZapSign.");
      } else if (data?.success) {
        await onSave();
        toast.success("Conexão OK! Token válido e salvo.");
      } else {
        toast.error(data?.error || "Token inválido. Verifique e tente novamente.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao conectar com ZapSign.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Token da API ZapSign</Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showToken ? "text" : "password"}
              placeholder="Seu token ZapSign"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="pr-9"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-9"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 space-y-1">
          <p className="text-[11px] font-medium text-amber-800">⚠️ Use o Token da API, NÃO o token do Webhook!</p>
          <p className="text-[11px] text-amber-700">
            No ZapSign: <span className="font-medium">Configurações → Integrações → ZapSign API → Access Token</span>
          </p>
          <p className="text-[10px] text-amber-600">
            O token do Webhook (em Integrações → Webhooks) serve apenas para receber notificações e não funciona aqui.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={saveToken} disabled={savingToken}>
          {savingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar token
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={testConnection} disabled={testing}>
          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Testar conexão
        </Button>
      </div>

      <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Configure o webhook no ZapSign:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background border rounded px-2 py-1.5 text-[11px] font-mono break-all">
              {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signature-webhook`}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signature-webhook`);
                toast.success("URL copiada!");
              }}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-[10px]">
            No painel ZapSign: Configurações → Integrações → Webhooks → Adicione a URL acima para os eventos "doc_signed" e "doc_refused".
          </p>
        </div>
    </div>
  );
}

export default function Settings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState({
    office: true,
    caseTypes: false,
    zapi: false,
    emailAccounts: false,
    syncLog: false,
    templates: false,
    hours: false,
    intimacoes: false,
    signature: false,
  });

  // Case types management
  const DEFAULT_CASE_TYPES = ["Divórcio", "Guarda", "Alimentos", "Inventário", "Outro"];
  const [caseTypes, setCaseTypes] = useState<string[]>(DEFAULT_CASE_TYPES);
  const [newCaseType, setNewCaseType] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    loadCaseTypes();
  }, []);

  const loadCaseTypes = async () => {
    const { data } = await (supabase.from("settings" as any).select("value").eq("key", "case_types").single()) as any;
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) setCaseTypes(parsed);
      } catch {}
    }
  };

  const saveCaseTypes = async (types: string[]) => {
    setCaseTypes(types);
    await (supabase.from("settings" as any) as any).upsert(
      { key: "case_types", value: JSON.stringify(types), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    toast.success("Tipos de ação atualizados!");
  };

  const addCaseType = () => {
    const trimmed = newCaseType.trim();
    if (!trimmed) return;
    if (caseTypes.includes(trimmed)) {
      toast.error("Tipo já existe.");
      return;
    }
    saveCaseTypes([...caseTypes, trimmed]);
    setNewCaseType("");
  };

  const deleteCaseType = (index: number) => {
    saveCaseTypes(caseTypes.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(caseTypes[index]);
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    if (caseTypes.some((t, i) => i !== editingIndex && t === trimmed)) {
      toast.error("Tipo já existe.");
      return;
    }
    const updated = [...caseTypes];
    updated[editingIndex] = trimmed;
    saveCaseTypes(updated);
    setEditingIndex(null);
    setEditingValue("");
  };
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

  const saveSetting = async (key: string) => {
    const value = val(key).trim();
    if (!value) throw new Error("Valor vazio");

    const { error } = await (supabase.from("settings" as any) as any).upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    if (error) throw error;
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

  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const maskOab = (v: string) => {
    const upper = v.toUpperCase();
    // Allow typing "OAB/XX 123456"
    const match = upper.match(/^(OAB\/?)([A-Z]{0,2})\s?(\d{0,6})$/);
    if (!match && upper.length > 0) {
      // If starts with just letters, prepend OAB/
      const digits = v.replace(/\D/g, "").slice(0, 6);
      const letters = v.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
      if (letters.length > 0 || digits.length > 0) {
        return `OAB/${letters}${letters.length && digits.length ? " " : ""}${digits}`;
      }
      return v;
    }
    if (match) {
      const [, , state, num] = match;
      return `OAB/${state}${state.length === 2 && num.length > 0 ? " " : ""}${num}`;
    }
    return v;
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
              onChange={(e) => set("office_oab", maskOab(e.target.value))}
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
              onChange={(e) => set("office_phone", maskPhone(e.target.value))}
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

      {/* Tipos de Ação */}
      <CollapsibleSection
        open={openSections.caseTypes}
        onOpenChange={() => toggle("caseTypes")}
        icon={Scale}
        iconBg="bg-primary/10 text-primary"
        title="Tipos de Ação"
        description="Gerencie os tipos de ação disponíveis nos casos"
      >
        <div className="space-y-3">
          <div className="border rounded-lg divide-y">
            {caseTypes.map((type, index) => (
              <div key={index} className="flex items-center gap-2 px-3 py-2">
                {editingIndex === index ? (
                  <>
                    <Input
                      className="h-7 text-xs flex-1"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmEdit()}
                      autoFocus
                    />
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={confirmEdit}>
                      Salvar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingIndex(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{type}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(index)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteCaseType(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="Novo tipo de ação..."
              value={newCaseType}
              onChange={(e) => setNewCaseType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCaseType()}
            />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addCaseType}>
              <Plus className="w-3 h-3" />
              Adicionar
            </Button>
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

      {/* Contas de E-mail Judicial */}
      <CollapsibleSection
        open={openSections.emailAccounts}
        onOpenChange={() => toggle("emailAccounts")}
        icon={Mail}
        iconBg="bg-amber-500/10 text-amber-600"
        title="Contas de E-mail Judicial"
        description="Monitore intimações via Gmail ou Hostinger/IMAP"
      >
        <EmailAccountsSection />
      </CollapsibleSection>

      {/* Histórico de Sincronização */}
      <SyncLogSection
        open={openSections.syncLog}
        onOpenChange={() => toggle("syncLog")}
      />

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

      {/* Assinatura Digital */}
      <CollapsibleSection
        open={openSections.signature}
        onOpenChange={() => toggle("signature")}
        icon={PenLine}
        iconBg="bg-primary/10 text-primary"
        title="Assinatura Digital"
        description="Configure a integração com ZapSign para assinaturas eletrônicas"
      >
        <SignatureSettings
          value={val("signature_api_token")}
          onChange={(v) => set("signature_api_token", v)}
        />
      </CollapsibleSection>

      {/* Monitoramento de Intimações */}
      <CollapsibleSection
        open={openSections.intimacoes}
        onOpenChange={() => toggle("intimacoes")}
        icon={Bell}
        iconBg="bg-amber-500/10 text-amber-600"
        title="Monitoramento de E-mail Judicial"
        description="Receba intimações automaticamente via webhook"
      >
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Endpoint para receber e-mails judiciais:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border rounded px-2 py-1.5 text-[11px] font-mono break-all">
                {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-intimacao`}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-intimacao`);
                  toast.success("URL copiada!");
                }}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">Como configurar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Configure uma regra de encaminhamento no Gmail para o webhook acima</li>
              <li>Ou use o Zapier/Make para enviar e-mails de domínios <code className="bg-background px-1 rounded">*.jus.br</code></li>
              <li>O sistema processará automaticamente com IA (Claude) e extrairá dados do processo</li>
            </ol>
            <p className="mt-2"><strong>Payload esperado (POST JSON):</strong></p>
            <pre className="bg-background border rounded px-2 py-1.5 text-[10px] font-mono mt-1 overflow-x-auto">
{`{
  "subject": "Intimação — Proc. 123...",
  "body": "Conteúdo do e-mail...",
  "from": "noreply@tjsp.jus.br",
  "date": "2024-01-15T10:00:00Z"
}`}
            </pre>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
