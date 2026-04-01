import { useState, useEffect } from "react";
import { Save, Loader2, Mail, Eye, Palette, Type, Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EMAIL_KEYS = [
  "email_welcome_subject",
  "email_welcome_body",
  "email_welcome_enabled",
  "email_signature_html",
  "email_primary_color",
  "email_logo_url",
  "email_footer_text",
  "email_font_family",
  "office_name",
];

const FONT_OPTIONS = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', Helvetica, sans-serif", label: "Helvetica" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Segoe UI', Tahoma, sans-serif", label: "Segoe UI" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
];

export default function EmailSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from("settings").select("key, value").in("key", EMAIL_KEYS);
    const map: Record<string, string> = {};
    data?.forEach((row: any) => { map[row.key] = row.value; });
    setSettings(map);
    setLoading(false);
  };

  const val = (key: string) => settings[key] || "";
  const set = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (!EMAIL_KEYS.includes(key)) continue;
        await supabase.from("settings").upsert({ key, value }, { onConflict: "key" });
      }
      toast.success("Configurações de e-mail salvas!");
    } catch {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const officeName = val("office_name") || "Escritório";
  const primaryColor = val("email_primary_color") || "#0F172A";
  const fontFamily = val("email_font_family") || "Arial, sans-serif";
  const logoUrl = val("email_logo_url");
  const footerText = val("email_footer_text") || `© ${new Date().getFullYear()} ${officeName}. Todos os direitos reservados.`;

  const defaultSubject = `Bem-vindo(a) ao ${officeName}`;
  const defaultBody = `Olá {nome}!\n\nSua conta foi criada com sucesso como {papel}.\n\nSeus dados de acesso:\n• E-mail: {email}\n• Senha: definida pelo administrador\n\nRecomendamos que altere sua senha no primeiro acesso.\n\nAtenciosamente,\nEquipe ${officeName}`;

  const subject = val("email_welcome_subject") || defaultSubject;
  const body = val("email_welcome_body") || defaultBody;

  const renderPreview = () => {
    const previewBody = body
      .replace("{nome}", "Maria Silva")
      .replace("{papel}", "cliente")
      .replace("{email}", "maria@email.com");

    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-muted/30 px-4 py-2 border-b flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Pré-visualização</span>
        </div>
        <div className="p-1">
          <div
            style={{
              fontFamily,
              maxWidth: 600,
              margin: "0 auto",
              backgroundColor: "#ffffff",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: primaryColor,
                padding: "28px 32px",
                textAlign: "center" as const,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ maxHeight: 56, margin: "0 auto", display: "block" }} />
              ) : (
                <span style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>
                  {officeName}
                </span>
              )}
            </div>

            {/* Accent bar */}
            <div style={{ height: 4, background: `linear-gradient(90deg, #D97706, ${primaryColor})` }} />

            {/* Body */}
            <div style={{ padding: "36px 32px 28px" }}>
              <h2 style={{ color: primaryColor, fontSize: 22, fontWeight: 700, margin: "0 0 20px", lineHeight: 1.3 }}>
                {subject}
              </h2>
              <div style={{ color: "#334155", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-line" }}>
                {previewBody}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                padding: "20px 32px",
                textAlign: "center" as const,
              }}
            >
              {val("email_signature_html") && (
                <div
                  className="mb-3 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: val("email_signature_html") }}
                />
              )}
              <p style={{ color: "#94a3b8", fontSize: 11, margin: 0 }}>{footerText}</p>
            </div>
          </div>
        </div>
                  className="mt-3 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: val("email_signature_html") }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações de E-mail</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize os e-mails enviados pelo sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)}>
            <Eye className="w-4 h-4 mr-1.5" />
            {previewMode ? "Editar" : "Pré-visualizar"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {previewMode ? (
        renderPreview()
      ) : (
        <Tabs defaultValue="welcome" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="welcome" className="text-xs">
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              Boas-vindas
            </TabsTrigger>
            <TabsTrigger value="branding" className="text-xs">
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="signature" className="text-xs">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Assinatura
            </TabsTrigger>
          </TabsList>

          {/* Welcome Email Tab */}
          <TabsContent value="welcome" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">E-mail de Boas-vindas</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Enviado automaticamente ao criar novos usuários
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="welcome-enabled" className="text-xs">Ativo</Label>
                    <Switch
                      id="welcome-enabled"
                      checked={val("email_welcome_enabled") !== "false"}
                      onCheckedChange={(v) => set("email_welcome_enabled", v ? "true" : "false")}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Assunto</Label>
                  <Input
                    placeholder={defaultSubject}
                    value={val("email_welcome_subject")}
                    onChange={(e) => set("email_welcome_subject", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Corpo do e-mail</Label>
                  <Textarea
                    rows={10}
                    placeholder={defaultBody}
                    value={val("email_welcome_body")}
                    onChange={(e) => set("email_welcome_body", e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[
                      { tag: "{nome}", desc: "Nome do usuário" },
                      { tag: "{email}", desc: "E-mail do usuário" },
                      { tag: "{papel}", desc: "Papel (cliente, advogado, admin)" },
                      { tag: "{escritorio}", desc: "Nome do escritório" },
                    ].map((v) => (
                      <span key={v.tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                        <code className="font-mono font-medium text-foreground">{v.tag}</code>
                        {v.desc}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Identidade Visual</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Personalize a aparência dos e-mails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Cor principal</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => set("email_primary_color", e.target.value)}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <Input
                        value={val("email_primary_color") || "#0F172A"}
                        onChange={(e) => set("email_primary_color", e.target.value)}
                        className="flex-1"
                        placeholder="#0F172A"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Fonte</Label>
                    <Select
                      value={fontFamily}
                      onValueChange={(v) => set("email_font_family", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            <span style={{ fontFamily: f.value }}>{f.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">URL do Logo</Label>
                  <Input
                    placeholder="https://exemplo.com/logo.png"
                    value={val("email_logo_url")}
                    onChange={(e) => set("email_logo_url", e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Recomendado: imagem PNG transparente, máximo 200px de largura
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Texto do rodapé</Label>
                  <Input
                    placeholder={`© ${new Date().getFullYear()} ${officeName}. Todos os direitos reservados.`}
                    value={val("email_footer_text")}
                    onChange={(e) => set("email_footer_text", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signature Tab */}
          <TabsContent value="signature" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assinatura do E-mail</CardTitle>
                <CardDescription className="text-xs mt-1">
                  HTML personalizado adicionado ao rodapé dos e-mails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">HTML da assinatura</Label>
                  <Textarea
                    rows={8}
                    placeholder={`<p style="font-size:12px;color:#64748b;">
  <strong>${officeName}</strong><br/>
  OAB/XX 00.000<br/>
  Tel: (00) 0000-0000<br/>
  email@escritorio.com
</p>`}
                    value={val("email_signature_html")}
                    onChange={(e) => set("email_signature_html", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                {val("email_signature_html") && (
                  <div className="border rounded-md p-4 bg-muted/30">
                    <Label className="text-xs text-muted-foreground mb-2 block">Pré-visualização:</Label>
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{ __html: val("email_signature_html") }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
