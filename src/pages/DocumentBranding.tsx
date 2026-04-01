import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Save, Loader2, Upload, Image, FileText, Palette, Type, Mail,
  Eye, Trash2, CheckCircle2,
} from "lucide-react";

const FONT_OPTIONS = [
  "Arial", "Times New Roman", "Georgia", "Garamond", "Calibri",
  "Cambria", "Verdana", "Tahoma", "Trebuchet MS",
];

interface BrandingConfig {
  id?: string;
  name: string;
  logo_url: string | null;
  letterhead_image_url: string | null;
  header_text: string | null;
  footer_text: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  font_size_body: number;
  font_size_heading: number;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  email_signature_html: string | null;
  is_default: boolean;
}

const DEFAULT_CONFIG: BrandingConfig = {
  name: "Padrão",
  logo_url: null,
  letterhead_image_url: null,
  header_text: "",
  footer_text: "",
  primary_color: "#1E3A5F",
  secondary_color: "#2B9E8F",
  font_family: "Arial",
  font_size_body: 12,
  font_size_heading: 14,
  margin_top: 30,
  margin_bottom: 25,
  margin_left: 30,
  margin_right: 20,
  email_signature_html: "",
  is_default: true,
};

export default function DocumentBranding() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "letterhead" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);

  const { data: branding, isLoading } = useQuery({
    queryKey: ["document-branding"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_branding" as any).select("*").eq("is_default", true).maybeSingle()) as any;
      if (error) throw error;
      return data as BrandingConfig | null;
    },
  });

  useEffect(() => {
    if (branding) setConfig(branding);
  }, [branding]);

  const set = (key: keyof BrandingConfig, value: any) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleUpload = async (file: File, type: "logo" | "letterhead") => {
    setUploading(type);
    try {
      const ext = file.name.split(".").pop();
      const path = `branding/${type}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("case-documents")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("case-documents")
        .getPublicUrl(path);

      const field = type === "logo" ? "logo_url" : "letterhead_image_url";
      set(field, urlData.publicUrl);
      toast.success(`${type === "logo" ? "Logo" : "Papel timbrado"} enviado!`);
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config, updated_at: new Date().toISOString() };
      delete (payload as any).id;

      if (branding?.id) {
        const { error } = await (supabase.from("document_branding" as any) as any)
          .update(payload)
          .eq("id", branding.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("document_branding" as any) as any)
          .insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["document-branding"] });
      toast.success("Configurações de formatação salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Formatação de Documentos</h1>
            <p className="text-sm text-muted-foreground">
              Configure papel timbrado, fontes, cores e assinatura de e-mail
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <Tabs defaultValue="letterhead" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="letterhead" className="text-xs gap-1.5">
            <Image className="w-3.5 h-3.5" />
            Papel Timbrado
          </TabsTrigger>
          <TabsTrigger value="typography" className="text-xs gap-1.5">
            <Type className="w-3.5 h-3.5" />
            Tipografia
          </TabsTrigger>
          <TabsTrigger value="layout" className="text-xs gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="email" className="text-xs gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Assinatura E-mail
          </TabsTrigger>
        </TabsList>

        {/* PAPEL TIMBRADO */}
        <TabsContent value="letterhead" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Logo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Logo do Escritório</CardTitle>
                <CardDescription className="text-xs">
                  Aparecerá no canto superior do documento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {config.logo_url ? (
                  <div className="relative group">
                    <img
                      src={config.logo_url}
                      alt="Logo"
                      className="w-full h-32 object-contain rounded-lg border bg-background p-2"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => set("logo_url", null)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  >
                    {uploading === "logo" ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Enviar logo</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")}
                />
              </CardContent>
            </Card>

            {/* Letterhead template */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Template de Timbrado</CardTitle>
                <CardDescription className="text-xs">
                  Upload de imagem/PDF com seu papel timbrado completo (opcional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {config.letterhead_image_url ? (
                  <div className="relative group">
                    <img
                      src={config.letterhead_image_url}
                      alt="Timbrado"
                      className="w-full h-32 object-contain rounded-lg border bg-background p-2"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => set("letterhead_image_url", null)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => letterheadInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  >
                    {uploading === "letterhead" ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Enviar timbrado</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={letterheadInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "letterhead")}
                />
              </CardContent>
            </Card>
          </div>

          {/* Header/Footer text */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cabeçalho e Rodapé</CardTitle>
              <CardDescription className="text-xs">
                Texto que aparecerá no cabeçalho e rodapé de todos os documentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Texto do Cabeçalho</Label>
                <Textarea
                  rows={3}
                  placeholder="Ex: Dra. Daiane Rosendo — OAB/XX 123456&#10;Advocacia & Assessoria Jurídica"
                  value={config.header_text || ""}
                  onChange={(e) => set("header_text", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Texto do Rodapé</Label>
                <Textarea
                  rows={2}
                  placeholder="Ex: Rua Example, 123 — Centro — Cidade/UF — Tel: (11) 99999-9999"
                  value={config.footer_text || ""}
                  onChange={(e) => set("footer_text", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cores do Documento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Cor Primária (títulos)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.primary_color}
                      onChange={(e) => set("primary_color", e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={config.primary_color}
                      onChange={(e) => set("primary_color", e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cor Secundária (linhas/detalhes)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.secondary_color}
                      onChange={(e) => set("secondary_color", e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={config.secondary_color}
                      onChange={(e) => set("secondary_color", e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIPOGRAFIA */}
        <TabsContent value="typography" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Fonte e Tamanhos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Fonte Principal</Label>
                <Select value={config.font_family} onValueChange={(v) => set("font_family", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        <span style={{ fontFamily: f }}>{f}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Tamanho do Texto (pt)</Label>
                  <Input
                    type="number"
                    min={8}
                    max={16}
                    value={config.font_size_body}
                    onChange={(e) => set("font_size_body", parseInt(e.target.value) || 12)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tamanho dos Títulos (pt)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={24}
                    value={config.font_size_heading}
                    onChange={(e) => set("font_size_heading", parseInt(e.target.value) || 14)}
                  />
                </div>
              </div>

              {/* Preview */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="w-3.5 h-3.5" />
                  Pré-visualização
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <p
                    style={{
                      fontFamily: config.font_family,
                      fontSize: `${config.font_size_heading}pt`,
                      color: config.primary_color,
                      fontWeight: "bold",
                      marginBottom: 8,
                    }}
                  >
                    EXCELENTÍSSIMO SENHOR DOUTOR JUIZ
                  </p>
                  <p
                    style={{
                      fontFamily: config.font_family,
                      fontSize: `${config.font_size_body}pt`,
                      color: "#1A202C",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>FULANO DE TAL</strong>, brasileiro(a), solteiro(a), residente e
                    domiciliado(a) na Rua Exemplo, nº 123, Bairro Centro, Cidade/UF, CPF nº
                    000.000.000-00, vem respeitosamente à presença de Vossa Excelência...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LAYOUT */}
        <TabsContent value="layout" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Margens do Documento (mm)</CardTitle>
              <CardDescription className="text-xs">
                Padrão ABNT: Superior 30mm, Inferior 25mm, Esquerda 30mm, Direita 20mm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Superior</Label>
                  <Input
                    type="number"
                    min={10}
                    max={50}
                    value={config.margin_top}
                    onChange={(e) => set("margin_top", parseInt(e.target.value) || 30)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Inferior</Label>
                  <Input
                    type="number"
                    min={10}
                    max={50}
                    value={config.margin_bottom}
                    onChange={(e) => set("margin_bottom", parseInt(e.target.value) || 25)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Esquerda</Label>
                  <Input
                    type="number"
                    min={10}
                    max={50}
                    value={config.margin_left}
                    onChange={(e) => set("margin_left", parseInt(e.target.value) || 30)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Direita</Label>
                  <Input
                    type="number"
                    min={10}
                    max={50}
                    value={config.margin_right}
                    onChange={(e) => set("margin_right", parseInt(e.target.value) || 20)}
                  />
                </div>
              </div>

              {/* Visual margin preview */}
              <div className="mt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Eye className="w-3.5 h-3.5" />
                  Proporção visual
                </div>
                <div className="w-48 h-64 mx-auto border-2 rounded relative bg-white">
                  <div
                    className="absolute bg-muted/30 border border-dashed border-muted-foreground/30"
                    style={{
                      top: `${(config.margin_top / 297) * 100}%`,
                      left: `${(config.margin_left / 210) * 100}%`,
                      right: `${(config.margin_right / 210) * 100}%`,
                      bottom: `${(config.margin_bottom / 297) * 100}%`,
                    }}
                  >
                    <div className="p-1">
                      <div className="w-full h-1 bg-muted-foreground/20 rounded mb-1" />
                      <div className="w-3/4 h-1 bg-muted-foreground/20 rounded mb-1" />
                      <div className="w-full h-1 bg-muted-foreground/10 rounded mb-1" />
                      <div className="w-5/6 h-1 bg-muted-foreground/10 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASSINATURA EMAIL */}
        <TabsContent value="email" className="space-y-4 mt-4">
          {/* Pre-defined templates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Modelos Prontos</CardTitle>
              <CardDescription className="text-xs">
                Escolha um modelo e personalize com seus dados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Minimalista */}
                <button
                  type="button"
                  className="border rounded-lg p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors group"
                  onClick={() => set("email_signature_html", `<div style="font-family: Arial, sans-serif; font-size: 12px; color: #333;">
  <p style="margin:0 0 2px;"><strong>Dra. Daiane Rosendo</strong></p>
  <p style="margin:0; font-size:11px; color:#666;">OAB/AM 12345 · (92) 99999-9999</p>
</div>`)}
                >
                  <div className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Minimalista</div>
                  <div className="border rounded p-2 bg-white text-[10px] leading-tight">
                    <p style={{ margin: 0, fontWeight: "bold" }}>Dra. Daiane Rosendo</p>
                    <p style={{ margin: 0, color: "#666" }}>OAB/AM 12345 · (92) 99999-9999</p>
                  </div>
                </button>

                {/* Completo */}
                <button
                  type="button"
                  className="border rounded-lg p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors group"
                  onClick={() => set("email_signature_html", `<div style="font-family: Arial, sans-serif; font-size: 12px; color: #333; border-top: 2px solid ${config.primary_color}; padding-top: 10px; margin-top: 10px;">
  <p style="margin:0 0 2px;"><strong style="color:${config.primary_color};">Dra. Daiane Rosendo</strong></p>
  <p style="margin:0 0 2px; font-size:11px;">Advocacia & Assessoria Jurídica</p>
  <p style="margin:0 0 2px; font-size:11px; color:#666;">OAB/AM 12345</p>
  <p style="margin:8px 0 0; font-size:11px; color:#666;">📞 (92) 99999-9999</p>
  <p style="margin:0; font-size:11px; color:#666;">✉️ contato@escritorio.com</p>
  <p style="margin:0; font-size:11px; color:#666;">📍 Rua Example, 123 — Manaus/AM</p>
</div>`)}
                >
                  <div className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Completo</div>
                  <div className="border rounded p-2 bg-white text-[10px] leading-tight">
                    <div style={{ borderTop: `2px solid ${config.primary_color}`, paddingTop: 4 }}>
                      <p style={{ margin: 0, fontWeight: "bold", color: config.primary_color }}>Dra. Daiane Rosendo</p>
                      <p style={{ margin: 0, fontSize: 9 }}>Advocacia & Assessoria</p>
                      <p style={{ margin: "3px 0 0", fontSize: 9, color: "#666" }}>📞 (92) 99999-9999</p>
                      <p style={{ margin: 0, fontSize: 9, color: "#666" }}>📍 Rua Example, 123</p>
                    </div>
                  </div>
                </button>

                {/* Com Logo */}
                <button
                  type="button"
                  className="border rounded-lg p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors group"
                  onClick={() => set("email_signature_html", `<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 12px; color: #333;">
  <tr>
    <td style="padding-right: 12px; vertical-align: top;">
      ${config.logo_url ? `<img src="${config.logo_url}" alt="Logo" width="60" height="60" style="border-radius:6px;" />` : `<div style="width:60px;height:60px;background:${config.primary_color};border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:18px;">DR</div>`}
    </td>
    <td style="border-left: 2px solid ${config.secondary_color}; padding-left: 12px; vertical-align: top;">
      <p style="margin:0 0 2px;"><strong style="color:${config.primary_color};">Dra. Daiane Rosendo</strong></p>
      <p style="margin:0 0 2px; font-size:11px;">OAB/AM 12345</p>
      <p style="margin:6px 0 0; font-size:11px; color:#666;">📞 (92) 99999-9999 · ✉️ contato@escritorio.com</p>
      <p style="margin:0; font-size:11px; color:#666;">📍 Rua Example, 123 — Manaus/AM</p>
    </td>
  </tr>
</table>`)}
                >
                  <div className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Com Logo</div>
                  <div className="border rounded p-2 bg-white text-[10px] leading-tight">
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-white text-[8px] font-bold" style={{ background: config.primary_color }}>DR</div>
                      <div style={{ borderLeft: `2px solid ${config.secondary_color}`, paddingLeft: 6 }}>
                        <p style={{ margin: 0, fontWeight: "bold", color: config.primary_color }}>Dra. Daiane Rosendo</p>
                        <p style={{ margin: 0, fontSize: 9 }}>OAB/AM 12345</p>
                        <p style={{ margin: "2px 0 0", fontSize: 9, color: "#666" }}>📞 (92) 99999-9999</p>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Editor de Assinatura</CardTitle>
              <CardDescription className="text-xs">
                Edite o HTML diretamente ou use um modelo acima como ponto de partida
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={10}
                placeholder={`<div style="font-family: Arial; font-size: 12px; color: #333;">
  <p><strong>Dra. Daiane Rosendo</strong></p>
  <p>OAB/XX 123456</p>
  <p>Tel: (11) 99999-9999</p>
  <p>contato@escritorio.com</p>
</div>`}
                value={config.email_signature_html || ""}
                onChange={(e) => set("email_signature_html", e.target.value)}
                className="font-mono text-xs"
              />

              {config.email_signature_html && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" />
                    Pré-visualização
                  </div>
                  <div className="border rounded-lg p-4 bg-white">
                    <div
                      dangerouslySetInnerHTML={{ __html: config.email_signature_html }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Pré-visualização do Documento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border rounded-lg bg-white mx-auto shadow-sm"
            style={{
              width: "100%",
              maxWidth: 595,
              minHeight: 400,
              padding: `${config.margin_top * 1.2}px ${config.margin_right * 1.2}px ${config.margin_bottom * 1.2}px ${config.margin_left * 1.2}px`,
              position: "relative",
            }}
          >
            {/* Letterhead background */}
            {config.letterhead_image_url && (
              <img
                src={config.letterhead_image_url}
                alt=""
                className="absolute inset-0 w-full h-full object-contain opacity-10 pointer-events-none"
              />
            )}

            {/* Header */}
            <div className="flex items-start gap-3 mb-4 relative z-10">
              {config.logo_url && (
                <img src={config.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
              )}
              {config.header_text && (
                <div>
                  {config.header_text.split("\n").map((line, i) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: config.font_family,
                        fontSize: i === 0 ? `${config.font_size_body}pt` : `${config.font_size_body - 1}pt`,
                        color: config.primary_color,
                        fontWeight: i === 0 ? "bold" : "normal",
                        lineHeight: 1.4,
                      }}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {(config.logo_url || config.header_text) && (
              <div
                className="mb-4"
                style={{ borderBottom: `2px solid ${config.secondary_color}` }}
              />
            )}

            {/* Body preview */}
            <div className="relative z-10">
              <p
                style={{
                  fontFamily: config.font_family,
                  fontSize: `${config.font_size_heading}pt`,
                  color: config.primary_color,
                  fontWeight: "bold",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                TÍTULO DO DOCUMENTO
              </p>
              <p
                style={{
                  fontFamily: config.font_family,
                  fontSize: `${config.font_size_body}pt`,
                  color: "#1A202C",
                  lineHeight: 1.8,
                  textAlign: "justify",
                }}
              >
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                quis nostrud exercitation ullamco laboris.
              </p>
            </div>

            {/* Footer */}
            {config.footer_text && (
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
                <div
                  className="mb-2"
                  style={{ borderTop: `1px solid ${config.secondary_color}` }}
                />
                <p
                  style={{
                    fontFamily: config.font_family,
                    fontSize: `${config.font_size_body - 2}pt`,
                    color: "#718096",
                    textAlign: "center",
                  }}
                >
                  {config.footer_text}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
