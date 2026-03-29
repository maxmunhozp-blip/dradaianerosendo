import { useState, useEffect } from "react";
import { Mail, Plus, RefreshCw, Trash2, Loader2, CheckCircle2, XCircle, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface EmailAccount {
  id: string;
  created_at: string;
  label: string;
  email: string;
  platform: string;
  status: string;
  last_sync: string | null;
  access_token: string | null;
  refresh_token: string | null;
  gmail_message_id_cursor: string | null;
  provider: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  imap_password: string | null;
}

const PLATFORMS = ["PJe", "eSAJ", "PROJUDI", "e-PROC", "Todos"];

function useEmailAccounts() {
  return useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("email_accounts") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailAccount[];
    },
  });
}

function useDeleteEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("email_accounts") as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
      toast.success("Conta removida com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao remover: " + err.message),
  });
}

function useSyncGmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId?: string) => {
      const { data, error } = await supabase.functions.invoke("sync-gmail", {
        body: accountId ? { account_id: accountId } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
      qc.invalidateQueries({ queryKey: ["intimacoes"] });
      qc.invalidateQueries({ queryKey: ["intimacoes-count-novo"] });
      const count = data?.new_intimacoes ?? 0;
      toast.success(
        count > 0
          ? `${count} nova(s) intimação(ões) encontrada(s)!`
          : "Sincronização concluída. Nenhuma nova intimação."
      );
    },
    onError: (err: any) => toast.error("Erro na sincronização: " + err.message),
  });
}

export { useSyncGmail };

type ProviderTab = "gmail" | "hostinger";

export default function EmailAccountsSection() {
  const { data: accounts = [], isLoading } = useEmailAccounts();
  const deleteMutation = useDeleteEmailAccount();
  const syncMutation = useSyncGmail();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [providerTab, setProviderTab] = useState<ProviderTab>("gmail");
  const [newLabel, setNewLabel] = useState("");
  const [newPlatform, setNewPlatform] = useState("Todos");
  const [saving, setSaving] = useState(false);

  // Hostinger fields
  const [hostEmail, setHostEmail] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [imapHost, setImapHost] = useState("imap.hostinger.com");
  const [imapPort, setImapPort] = useState("993");

  const resetForm = () => {
    setNewLabel("");
    setNewPlatform("Todos");
    setHostEmail("");
    setHostPassword("");
    setImapHost("imap.hostinger.com");
    setImapPort("993");
    setProviderTab("gmail");
  };

  // Handle OAuth redirect
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      const hash = window.location.hash;
      if (!hash.includes("access_token")) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) return;

      const pending = localStorage.getItem("pending_email_account");
      if (!pending) return;

      const { label, platform } = JSON.parse(pending);
      localStorage.removeItem("pending_email_account");

      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${session.provider_token}` },
        });
        const userInfo = await res.json();

        const { error } = await (supabase.from("email_accounts") as any).insert({
          label,
          email: userInfo.email,
          platform,
          provider: "gmail",
          status: "conectado",
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token || null,
        });

        if (error) throw error;
        toast.success(`Conta ${userInfo.email} conectada com sucesso!`);
        qc.invalidateQueries({ queryKey: ["email-accounts"] });
      } catch (err: any) {
        toast.error("Erro ao salvar conta: " + err.message);
      }
    };

    handleOAuthRedirect();
  }, [qc]);

  const handleConnectGmail = async () => {
    if (!newLabel.trim()) {
      toast.error("Informe um nome para a conta");
      return;
    }

    setSaving(true);
    localStorage.setItem(
      "pending_email_account",
      JSON.stringify({ label: newLabel, platform: newPlatform })
    );

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/gmail.readonly",
        redirectTo: window.location.origin + "/settings",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) {
      toast.error("Erro ao iniciar OAuth: " + error.message);
      localStorage.removeItem("pending_email_account");
    }
    setSaving(false);
  };

  const handleConnectHostinger = async () => {
    if (!newLabel.trim()) { toast.error("Informe um nome para a conta"); return; }
    if (!hostEmail.trim()) { toast.error("Informe o e-mail"); return; }
    if (!hostPassword.trim()) { toast.error("Informe a senha"); return; }

    setSaving(true);
    try {
      // Test IMAP connection
      const { data, error } = await supabase.functions.invoke("test-imap", {
        body: {
          host: imapHost,
          port: parseInt(imapPort),
          user: hostEmail,
          password: hostPassword,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na conexão IMAP");

      // Save account
      const { error: insertError } = await (supabase.from("email_accounts") as any).insert({
        label: newLabel,
        email: hostEmail,
        platform: newPlatform,
        provider: "hostinger",
        status: "conectado",
        imap_host: imapHost,
        imap_port: parseInt(imapPort),
        imap_user: hostEmail,
        imap_password: btoa(hostPassword), // base64 encode
      });

      if (insertError) throw insertError;
      toast.success(`Conta ${hostEmail} conectada com sucesso!`);
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {accounts.length} conta(s) configurada(s)
        </p>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar conta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar conta de e-mail</DialogTitle>
              <DialogDescription>
                Conecte uma conta Gmail ou Hostinger para monitorar intimações.
              </DialogDescription>
            </DialogHeader>

            {/* Provider selector */}
            <div className="grid grid-cols-2 gap-3 py-2">
              <button
                type="button"
                onClick={() => setProviderTab("gmail")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  providerTab === "gmail"
                    ? "border-amber-500 bg-amber-50"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Mail className="w-6 h-6 text-red-500" />
                <span className="text-sm font-medium">Gmail</span>
                <span className="text-[10px] text-muted-foreground text-center">Conectar via OAuth Google</span>
              </button>
              <button
                type="button"
                onClick={() => setProviderTab("hostinger")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  providerTab === "hostinger"
                    ? "border-amber-500 bg-amber-50"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Server className="w-6 h-6 text-purple-500" />
                <span className="text-sm font-medium">Hostinger</span>
                <span className="text-[10px] text-muted-foreground text-center">Configurar com e-mail Hostinger</span>
              </button>
            </div>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs">Nome da conta</Label>
                <Input
                  placeholder={providerTab === "gmail" ? "Ex: Gmail PJe SP" : "Ex: Hostinger PJe"}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Plataforma</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {providerTab === "hostinger" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">E-mail</Label>
                    <Input
                      type="email"
                      placeholder="daiane@escritorio.com.br"
                      value={hostEmail}
                      onChange={(e) => setHostEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Senha</Label>
                    <Input
                      type="password"
                      placeholder="Senha do e-mail"
                      value={hostPassword}
                      onChange={(e) => setHostPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">IMAP Host</Label>
                      <Input
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">IMAP Porta</Label>
                      <Input
                        type="number"
                        value={imapPort}
                        onChange={(e) => setImapPort(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              {providerTab === "gmail" ? (
                <Button onClick={handleConnectGmail} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
                  Conectar Gmail
                </Button>
              ) : (
                <Button onClick={handleConnectHostinger} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Server className="w-4 h-4 mr-1" />}
                  Testar e conectar
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-muted/50 rounded-md p-4 text-center text-xs text-muted-foreground">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma conta de e-mail conectada.</p>
          <p className="mt-1">Adicione uma conta Gmail ou Hostinger para monitorar intimações.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between border rounded-lg px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                {account.provider === "hostinger" ? (
                  <Server className="w-4 h-4 text-purple-500 shrink-0" />
                ) : (
                  <Mail className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{account.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {account.platform}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                      {account.provider}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{account.email}</span>
                    {account.last_sync && (
                      <>
                        <span>·</span>
                        <span>Sync: {format(new Date(account.last_sync), "dd/MM HH:mm")}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {account.status === "conectado" ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    <XCircle className="w-3 h-3 mr-0.5" />
                    {account.status === "erro" ? "Erro" : "Desconectado"}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={syncMutation.isPending}
                  onClick={() => syncMutation.mutate(account.id)}
                  title="Sincronizar agora"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (confirm("Remover esta conta de e-mail?")) {
                      deleteMutation.mutate(account.id);
                    }
                  }}
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Como funciona:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Clique em "Adicionar conta" e escolha Gmail ou Hostinger</li>
          <li>O sistema buscará e-mails de domínios <code className="bg-background px-1 rounded">*.jus.br</code></li>
          <li>Novas intimações serão processadas automaticamente com IA</li>
          <li>Você receberá notificações push para prazos urgentes</li>
        </ol>
      </div>
    </div>
  );
}
