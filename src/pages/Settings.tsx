import { useState, useEffect } from "react";
import { Save, MessageSquare, ChevronDown, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const [zapiInstanceId, setZapiInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [zapiOpen, setZapiOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["zapi_instance_id", "zapi_token"]);

    if (data) {
      for (const row of data) {
        if (row.key === "zapi_instance_id") setZapiInstanceId(row.value);
        if (row.key === "zapi_token") setZapiToken(row.value);
      }
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const entries = [
        { key: "zapi_instance_id", value: zapiInstanceId },
        { key: "zapi_token", value: zapiToken },
      ];

      for (const entry of entries) {
        const { error } = await supabase
          .from("settings")
          .upsert(
            { key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as integrações e preferências do sistema.
        </p>
      </div>

      <Collapsible open={zapiOpen} onOpenChange={setZapiOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-medium">Z-API (WhatsApp)</CardTitle>
                    <CardDescription className="text-xs">
                      Configure sua instância para envio de mensagens via WhatsApp
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    zapiOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="instance-id" className="text-xs">
                      Instance ID
                    </Label>
                    <Input
                      id="instance-id"
                      placeholder="Ex: 3C7B2A1D4E5F..."
                      value={zapiInstanceId}
                      onChange={(e) => setZapiInstanceId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="token" className="text-xs">
                      Token
                    </Label>
                    <Input
                      id="token"
                      type="password"
                      placeholder="Seu token Z-API"
                      value={zapiToken}
                      onChange={(e) => setZapiToken(e.target.value)}
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

                  <Button
                    onClick={saveSettings}
                    disabled={saving || !zapiInstanceId || !zapiToken}
                    className="w-full"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar configurações"}
                  </Button>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
