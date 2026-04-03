import { useState, useRef, useEffect } from "react";
import {
  Mail, RefreshCw, Search, Filter, Inbox, Loader2, ExternalLink,
  AlertTriangle, FileText, ChevronRight, Server, Edit, Clock,
  Trash2, Archive, Reply, MailOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSyncGmail } from "@/components/EmailAccountsSection";

interface EmailAccount {
  id: string;
  label: string;
  email: string;
  provider: string;
  last_sync: string | null;
}

const stripHtml = (html?: string | null): string => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
};

interface EmailMessage {
  id: string;
  created_at: string;
  email_account_id: string;
  message_uid: string;
  from_email: string | null;
  from_name: string | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  received_at: string | null;
  is_read: boolean;
  is_judicial: boolean;
  intimacao_id: string | null;
  category: string;
}

type EmailFilter = "all" | "unread" | "judicial" | "financial" | "sent" | "other";

function useEmailAccounts() {
  return useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("email_accounts") as any)
        .select("id, label, email, provider, last_sync")
        .in("status", ["conectado", "sincronizando", "erro"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailAccount[];
    },
  });
}

function useEmailMessages(accountId: string | null, filter: EmailFilter, search: string) {
  return useQuery({
    queryKey: ["email-messages", accountId, filter, search],
    queryFn: async () => {
      let query = (supabase.from("email_messages") as any)
        .select("*")
        .order("received_at", { ascending: false })
        .limit(500);

      if (accountId && accountId !== "all") {
        query = query.eq("email_account_id", accountId);
      }
      if (filter === "unread") query = query.eq("is_read", false);
      if (filter === "judicial") query = query.eq("category", "judicial");
      if (filter === "financial") query = query.eq("category", "financial");
      if (filter === "sent") query = query.eq("direction", "outbound");
      if (filter === "other") query = query.eq("category", "other");
      if (search.trim()) query = query.ilike("subject", `%${search.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailMessage[];
    },
  });
}

function useSyncImap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId?: string) => {
      const { data, error } = await supabase.functions.invoke("sync-imap", {
        body: accountId ? { account_id: accountId } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-messages"] });
      qc.invalidateQueries({ queryKey: ["email-accounts"] });
      const count = data?.new_emails ?? 0;
      toast.success(count > 0 ? `${count} novo(s) e-mail(s) encontrado(s)!` : "Sincronização concluída.");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

function useRegisterIntimacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: EmailMessage) => {
      const { data, error } = await supabase.functions.invoke("process-intimacao", {
        body: {
          subject: email.subject,
          body: email.body_text,
          from_email: email.from_email,
          date: email.received_at,
          gmail_message_id: `mail_${email.id}`,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-messages"] });
      qc.invalidateQueries({ queryKey: ["intimacoes"] });
      toast.success("Intimação registrada com sucesso!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export default function MailPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    return localStorage.getItem("mail_selected_account") || "all";
  });

  useEffect(() => {
    localStorage.setItem("mail_selected_account", selectedAccountId);
  }, [selectedAccountId]);
  const [filter, setFilter] = useState<EmailFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: accounts = [] } = useEmailAccounts();
  const { data: emails = [], isLoading } = useEmailMessages(
    selectedAccountId === "all" ? null : selectedAccountId,
    filter,
    search
  );

  const syncGmail = useSyncGmail();
  const syncImap = useSyncImap();
  const registerIntimacao = useRegisterIntimacao();
  const qc = useQueryClient();

  const isSyncing = syncGmail.isPending || syncImap.isPending;

  const [sendingReply, setSendingReply] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sendingCompose, setSendingCompose] = useState(false);

  const handleSendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    const account = accounts.find(a => a.id === selectedEmail.email_account_id);
    if (!account) { toast.error("Conta de e-mail não encontrada"); return; }
    setSendingReply(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          account_id: selectedEmail.email_account_id,
          to: selectedEmail.from_email,
          subject: `Re: ${selectedEmail.subject}`,
          body: replyText,
          in_reply_to: selectedEmail.message_uid,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Resposta enviada com sucesso!");
      setReplyOpen(false);
      setReplyText("");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSendingReply(false);
    }
  };

  const handleSendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    const accountId = selectedAccountId !== "all" ? selectedAccountId : accounts[0]?.id;
    if (!accountId) { toast.error("Nenhuma conta disponível"); return; }
    setSendingCompose(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          account_id: accountId,
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("E-mail enviado com sucesso!");
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSendingCompose(false);
    }
  };

  const handleSync = () => {
    const accountId = selectedAccountId === "all" ? undefined : selectedAccountId;
    syncImap.mutate(accountId);
  };

  const handleMarkRead = async (email: EmailMessage) => {
    if (!email.is_read) {
      await (supabase.from("email_messages") as any)
        .update({ is_read: true })
        .eq("id", email.id);
      qc.invalidateQueries({ queryKey: ["email-messages"] });
    }
  };

  const handleDelete = async (email: EmailMessage) => {
    await (supabase.from("email_messages") as any)
      .delete()
      .eq("id", email.id);
    qc.invalidateQueries({ queryKey: ["email-messages"] });
    if (selectedEmail?.id === email.id) setSelectedEmail(null);
    toast.success("E-mail excluído");
  };

  const handleArchive = async (email: EmailMessage) => {
    await (supabase.from("email_messages") as any)
      .update({ is_read: true })
      .eq("id", email.id);
    qc.invalidateQueries({ queryKey: ["email-messages"] });
    if (selectedEmail?.id === email.id) setSelectedEmail(null);
    toast.success("E-mail arquivado");
  };

  // Write HTML content to iframe for safe rendering
  useEffect(() => {
    if (selectedEmail?.body_html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #1a1a1a; margin: 0; padding: 16px; line-height: 1.6; }
              img { max-width: 100%; height: auto; }
              a { color: #2563eb; }
              table { max-width: 100%; }
            </style>
          </head>
          <body>${selectedEmail.body_html}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [selectedEmail]);

  const accountsMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  const filterOptions: { value: EmailFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "unread", label: "Não lidos" },
    { value: "judicial", label: "Judiciais" },
    { value: "financial", label: "Financeiro" },
    { value: "sent", label: "Enviados" },
    { value: "other", label: "Outros" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecionar conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label} — {a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(() => {
            const lastSyncDate = selectedAccountId === "all"
              ? accounts.reduce<string | null>((latest, a) => {
                  if (!a.last_sync) return latest;
                  if (!latest) return a.last_sync;
                  return a.last_sync > latest ? a.last_sync : latest;
                }, null)
              : accounts.find(a => a.id === selectedAccountId)?.last_sync ?? null;

            return lastSyncDate ? (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Última sync: {format(new Date(lastSyncDate), "dd/MM HH:mm")}
              </span>
            ) : null;
          })()}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={isSyncing} onClick={handleSync}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
          <Button size="sm" variant="outline" className="text-amber-600 border-amber-300" onClick={() => setComposeOpen(!composeOpen)}>
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            Compor
          </Button>
        </div>
      </div>

      {/* Compose area */}
      {composeOpen && (
        <div className="border-b p-4 bg-muted/30 space-y-3 shrink-0">
          <h3 className="text-sm font-semibold">Novo e-mail</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Para (e-mail do destinatário)"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="Assunto"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              className="text-sm"
            />
          </div>
          <textarea
            className="w-full border rounded-md p-2 text-sm min-h-[100px] resize-y bg-background"
            placeholder="Escreva sua mensagem..."
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Enviando de: {selectedAccountId !== "all" ? accounts.find(a => a.id === selectedAccountId)?.email : accounts[0]?.email || "—"}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setComposeOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={sendingCompose} onClick={handleSendCompose}>
                {sendingCompose ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma conta de e-mail conectada</p>
            <Button variant="outline" size="sm" asChild>
              <a href="/settings">Configurar contas</a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left column — email list */}
          <div className="w-[35%] border-r flex flex-col min-h-0">
            <div className="p-3 space-y-2 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por assunto..."
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {filterOptions.map(f => (
                  <Button
                    key={f.value}
                    variant={filter === f.value ? "default" : "ghost"}
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum e-mail encontrado</p>
                </div>
              ) : (
                <div className="divide-y">
                  {emails.map(email => {
                    const isActive = selectedEmail?.id === email.id;
                    const acct = accountsMap[email.email_account_id];
                    return (
                      <button
                        key={email.id}
                        onClick={() => { setSelectedEmail(email); handleMarkRead(email); }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors ${
                          isActive ? "bg-muted" : ""
                        } ${!email.is_read ? "bg-amber-50/50" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {!email.is_read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              )}
                              <span className={`text-xs truncate ${!email.is_read ? "font-semibold" : ""}`}>
                                {email.from_name || email.from_email || "Desconhecido"}
                              </span>
                            </div>
                            <p className={`text-xs mt-0.5 truncate ${!email.is_read ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                              {email.subject}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {stripHtml(email.body_html || email.body_text)?.substring(0, 80)}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {email.received_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(email.received_at), "dd/MM HH:mm")}
                                </span>
                              )}
                              {email.category === "judicial" && (
                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[9px] px-1 py-0">
                                  Judicial
                                </Badge>
                              )}
                              {email.category === "financial" && (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[9px] px-1 py-0">
                                  Financeiro
                                </Badge>
                              )}
                              {(email as any).direction === "outbound" && (
                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[9px] px-1 py-0">
                                  Enviado
                                </Badge>
                              )}
                              {selectedAccountId === "all" && acct && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  {acct.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right column — email viewer */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedEmail ? (
              <>
                <div className="p-4 border-b shrink-0 space-y-2">
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-semibold text-foreground pr-4">
                      {selectedEmail.subject}
                    </h2>
                    <div className="flex items-center gap-1 shrink-0">
                      {selectedEmail.is_judicial && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] mr-1">
                          <AlertTriangle className="w-3 h-3 mr-0.5" />
                          Judicial
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Responder"
                        onClick={() => { setReplyOpen(!replyOpen); setReplyText(""); }}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Arquivar"
                        onClick={() => handleArchive(selectedEmail)}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={() => handleDelete(selectedEmail)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <strong>De:</strong> {selectedEmail.from_name ? `${selectedEmail.from_name} <${selectedEmail.from_email}>` : selectedEmail.from_email}
                    </span>
                    {selectedEmail.received_at && (
                      <span>{format(new Date(selectedEmail.received_at), "dd/MM/yyyy HH:mm")}</span>
                    )}
                  </div>
                  {selectedEmail.is_judicial && !selectedEmail.intimacao_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      disabled={registerIntimacao.isPending}
                      onClick={() => registerIntimacao.mutate(selectedEmail)}
                    >
                      {registerIntimacao.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 mr-1" />
                      )}
                      Registrar como Intimação
                    </Button>
                  )}
                  {selectedEmail.intimacao_id && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                      Intimação registrada
                    </Badge>
                  )}
                </div>

                {/* Reply area */}
                {replyOpen && (
                  <div className="p-3 border-b bg-muted/30 space-y-2 shrink-0">
                    <p className="text-xs text-muted-foreground">
                      Responder para: {selectedEmail.from_email}
                    </p>
                    <textarea
                      className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-y bg-background"
                      placeholder="Escreva sua resposta..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setReplyOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={sendingReply || !replyText.trim()}
                        onClick={handleSendReply}
                      >
                        {sendingReply ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Reply className="w-3.5 h-3.5 mr-1" />}
                        Enviar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Email body */}
                <div className="flex-1 min-h-0">
                  {selectedEmail.body_html ? (
                    <iframe
                      ref={iframeRef}
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin"
                      title="Conteúdo do e-mail"
                    />
                  ) : (
                    <ScrollArea className="h-full p-4">
                      <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                        {selectedEmail.body_text}
                      </pre>
                    </ScrollArea>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Mail className="w-10 h-10 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Selecione um e-mail para visualizar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
