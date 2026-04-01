import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { RequestDataModal } from "@/components/RequestDataModal";
import { ExtractionSuggestions } from "@/components/ExtractionSuggestions";
import { useClient, useUpdateClient, useDeleteClient } from "@/hooks/use-clients";
import { useCasesByClient, useCreateCase, useUpdateCase } from "@/hooks/use-cases";
import { useCaseTypes } from "@/hooks/use-case-types";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeletons";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft, Phone, Mail, Plus, FolderOpen, Send, Loader2,
  Pencil, Trash2, Save, X, ChevronDown, ChevronRight, MapPin, Users, UserX, Baby, ExternalLink, ScanSearch,
  CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { whatsappLink } from "@/lib/utils";

interface Child {
  name: string;
  birth_date: string;
  cpf?: string;
}

const CHILDREN_CASE_TYPES = ["Guarda", "Alimentos", "Divórcio", "Adoção", "Alienação Parental"];

function SectionHeader({ icon: Icon, title, open, editing, onToggle, onEdit }: {
  icon: React.ElementType; title: string; open: boolean;
  editing?: boolean; onToggle: () => void; onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md">
      <CollapsibleTrigger asChild>
        <button onClick={onToggle} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <Icon className="w-3.5 h-3.5" />
          {title}
        </button>
      </CollapsibleTrigger>
      {onEdit && !editing && (
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onEdit}>
          <Pencil className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id!);
  const { data: cases = [] } = useCasesByClient(id!);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const createCase = useCreateCase();
  const updateCase = useUpdateCase();
  const { data: caseTypesList = ["Divórcio", "Guarda", "Alimentos", "Inventário", "Outro"] } = useCaseTypes();

  const [notes, setNotes] = useState<string | null>(null);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [sendingPortal, setSendingPortal] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showRequestData, setShowRequestData] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const queryClient = useQueryClient();

  // Fetch all documents for this client's cases
  const caseIds = cases.map((c: any) => c.id);
  const { data: allDocs = [] } = useQuery({
    queryKey: ["client-all-docs", id, caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, case_id, file_url, extraction_status")
        .in("case_id", caseIds);
      if (error) throw error;
      return data || [];
    },
    enabled: caseIds.length > 0,
  });

  const pendingDocs = allDocs.filter(
    (d: any) => d.file_url && (!d.extraction_status || d.extraction_status === "pending")
  );

  const handleScanAll = async () => {
    if (pendingDocs.length === 0) {
      toast.info("Nenhum documento pendente para escanear");
      return;
    }
    setScanning(true);
    let success = 0;
    for (let i = 0; i < pendingDocs.length; i++) {
      const doc = pendingDocs[i];
      setScanProgress(`Escaneando documento ${i + 1} de ${pendingDocs.length}...`);
      try {
        await supabase.functions.invoke("process-document", {
          body: {
            document_id: doc.id,
            case_id: doc.case_id,
            client_id: id,
            file_url: doc.file_url,
            file_name: doc.name,
          },
        });
        success++;
      } catch (e) {
        console.error(`Erro ao escanear ${doc.name}:`, e);
      }
    }
    setScanProgress("");
    setScanning(false);
    queryClient.invalidateQueries({ queryKey: ["extraction-suggestions", id] });
    queryClient.invalidateQueries({ queryKey: ["client-all-docs", id] });
    toast.success(`Escaneamento concluído (${success}/${pendingDocs.length}) — verifique as sugestões abaixo.`);
  };

  // Section states
  const [personalOpen, setPersonalOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [opposingOpen, setOpposingOpen] = useState(false);

  // Edit states per section
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingOpposing, setEditingOpposing] = useState<string | null>(null); // case id

  // Forms
  const [personalForm, setPersonalForm] = useState<Record<string, string>>({});
  const [addressForm, setAddressForm] = useState<Record<string, string>>({});
  const [opposingForm, setOpposingForm] = useState<Record<string, string>>({});

  // Children state per case
  const [editingChildren, setEditingChildren] = useState<string | null>(null);
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [newChild, setNewChild] = useState<Child>({ name: "", birth_date: "", cpf: "" });

  const [caseForm, setCaseForm] = useState({
    case_type: "Divórcio", description: "", cnj_number: "", court: "",
  });

  const startEditPersonal = () => {
    if (!client) return;
    setPersonalForm({
      name: client.name || "", cpf: (client as any).cpf || "", rg: (client as any).rg || "",
      nationality: (client as any).nationality || "brasileiro(a)",
      marital_status: (client as any).marital_status || "",
      profession: (client as any).profession || "",
      email: client.email || "", phone: client.phone || "",
      origin: client.origin || "", status: client.status || "",
    });
    setEditingPersonal(true);
    setPersonalOpen(true);
  };

  const savePersonal = async () => {
    if (!client) return;
    if (!personalForm.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      await updateClient.mutateAsync({
        id: client.id, name: personalForm.name,
        cpf: personalForm.cpf || null, email: personalForm.email || null,
        phone: personalForm.phone || null, origin: personalForm.origin || null,
        status: personalForm.status,
        rg: personalForm.rg || null, nationality: personalForm.nationality || null,
        marital_status: personalForm.marital_status || null,
        profession: personalForm.profession || null,
      } as any);
      toast.success("Dados pessoais atualizados"); setEditingPersonal(false);
    } catch { toast.error("Erro ao salvar"); }
  };

  const startEditAddress = () => {
    if (!client) return;
    setAddressForm({
      address_zip: (client as any).address_zip || "",
      address_street: (client as any).address_street || "",
      address_number: (client as any).address_number || "",
      address_complement: (client as any).address_complement || "",
      address_neighborhood: (client as any).address_neighborhood || "",
      address_city: (client as any).address_city || "",
      address_state: (client as any).address_state || "",
    });
    setEditingAddress(true);
    setAddressOpen(true);
  };

  const fetchCep = useCallback(async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      setAddressForm(prev => ({
        ...prev,
        address_street: data.logradouro || prev.address_street,
        address_neighborhood: data.bairro || prev.address_neighborhood,
        address_city: data.localidade || prev.address_city,
        address_state: data.uf || prev.address_state,
      }));
      toast.success("Endereço preenchido automaticamente");
    } catch { toast.error("Erro ao buscar CEP"); }
  }, []);

  const saveAddress = async () => {
    if (!client) return;
    try {
      await updateClient.mutateAsync({
        id: client.id,
        address_zip: addressForm.address_zip || null,
        address_street: addressForm.address_street || null,
        address_number: addressForm.address_number || null,
        address_complement: addressForm.address_complement || null,
        address_neighborhood: addressForm.address_neighborhood || null,
        address_city: addressForm.address_city || null,
        address_state: addressForm.address_state || null,
      } as any);
      toast.success("Endereço atualizado"); setEditingAddress(false);
    } catch { toast.error("Erro ao salvar endereço"); }
  };

  const startEditOpposing = (caseItem: any) => {
    setOpposingForm({
      opposing_party_name: caseItem.opposing_party_name || "",
      opposing_party_cpf: caseItem.opposing_party_cpf || "",
      opposing_party_address: caseItem.opposing_party_address || "",
    });
    setEditingOpposing(caseItem.id);
    setOpposingOpen(true);
  };

  const saveOpposing = async () => {
    if (!editingOpposing) return;
    try {
      await updateCase.mutateAsync({
        id: editingOpposing,
        opposing_party_name: opposingForm.opposing_party_name || null,
        opposing_party_cpf: opposingForm.opposing_party_cpf || null,
        opposing_party_address: opposingForm.opposing_party_address || null,
      } as any);
      toast.success("Parte contrária atualizada"); setEditingOpposing(null);
    } catch { toast.error("Erro ao salvar"); }
  };

  const startEditChildren = (caseItem: any) => {
    setChildrenList(caseItem.children || []);
    setEditingChildren(caseItem.id);
    setChildrenOpen(true);
  };

  const addChild = () => {
    if (!newChild.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setChildrenList(prev => [...prev, { ...newChild }]);
    setNewChild({ name: "", birth_date: "", cpf: "" });
  };

  const removeChild = (idx: number) => setChildrenList(prev => prev.filter((_, i) => i !== idx));

  const saveChildren = async () => {
    if (!editingChildren) return;
    try {
      await updateCase.mutateAsync({
        id: editingChildren, children: childrenList,
      } as any);
      toast.success("Filhos atualizados"); setEditingChildren(null);
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!client) return;
    try {
      await updateClient.mutateAsync({ id: client.id, status: newStatus });
      toast.success(`Status alterado para ${newStatus}`);
    } catch { toast.error("Erro ao alterar status"); }
  };

  const handleDelete = async () => {
    if (!client) return;
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("Cliente removido"); navigate("/clients");
    } catch { toast.error("Erro ao remover cliente. Verifique se não há casos vinculados."); }
  };

  const handleInviteClient = async () => {
    if (!client?.email) { toast.error("Cliente não possui e-mail cadastrado"); return; }
    setInviting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: client.email,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      });
      if (error) throw error;
      toast.success(`Convite enviado para ${client.email}`);
    } catch (err: any) {
      toast.error("Erro ao enviar convite: " + err.message);
    } finally { setInviting(false); }
  };

  const handleSendPortalLink = async () => {
    if (!client) return;
    const phone = (cl.phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Cliente sem telefone cadastrado"); return; }
    setSendingPortal(true);
    try {
      // Check for existing valid session
      const { data: existing } = await supabase
        .from("client_sessions")
        .select("token, expires_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let token = existing?.token;
      if (!existing || new Date(existing.expires_at) < new Date()) {
        // Create new session
        const { data: newSession, error } = await supabase
          .from("client_sessions")
          .insert({ client_id: client.id })
          .select("token")
          .single();
        if (error) throw error;
        token = newSession.token;
      }

      const portalUrl = `${window.location.origin}/portal?token=${token}`;
      const firstName = client.name.split(" ")[0];
      const message = `Olá ${firstName}! Acesse sua área do cliente pelo link abaixo para acompanhar seu processo:\n\n${portalUrl}`;
      const waUrl = whatsappLink(phone, message);
      window.open(waUrl, "_blank");
      toast.success("Link do portal gerado!");
    } catch (err: any) {
      toast.error("Erro ao gerar link do portal");
      console.error(err);
    } finally { setSendingPortal(false); }
  };

  const handleSaveNotes = async () => {
    if (!client) return;
    try {
      await updateClient.mutateAsync({ id: client.id, notes: notes ?? client.notes ?? "" });
      toast.success("Anotações salvas");
    } catch { toast.error("Erro ao salvar anotações"); }
  };

  const handleCreateCase = async () => {
    if (!client) return;
    if (!caseForm.description.trim()) { toast.error("Descrição é obrigatória"); return; }
    try {
      await createCase.mutateAsync({
        client_id: client.id, case_type: caseForm.case_type,
        description: caseForm.description,
        cnj_number: caseForm.cnj_number || null, court: caseForm.court || null,
      });
      toast.success("Caso criado com sucesso"); setCaseDialogOpen(false);
      setCaseForm({ case_type: "Divórcio", description: "", cnj_number: "", court: "" });
    } catch { toast.error("Erro ao criar caso"); }
  };

  if (isLoading) return <DetailSkeleton />;
  if (!client) return (
    <div className="p-6">
      <EmptyState icon={FolderOpen} title="Cliente não encontrado" description="Este cliente pode ter sido removido ou o link está incorreto." />
    </div>
  );

  const cl = client as any;
  const hasChildrenCases = cases.some(c => CHILDREN_CASE_TYPES.includes(c.case_type));

  return (
    <div className="p-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/clients"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Voltar</Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{client.name}</h1>
            <Select value={client.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-auto h-7 text-xs border-none p-0">
                <StatusBadge status={client.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="contrato">Contrato</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {cl.cpf && <span>CPF: {cl.cpf}</span>}
            {cl.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{cl.phone}</span>}
            {cl.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{cl.email}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRequestData(true)} disabled={cases.length === 0}>
            <Send className="w-3.5 h-3.5 mr-1.5" />Solicitar Dados
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendPortalLink} disabled={sendingPortal || !cl.phone}>
            {sendingPortal ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}Enviar Portal
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Excluir
          </Button>
        </div>
      </div>

      {cases.length > 0 && (
        <RequestDataModal
          open={showRequestData}
          onOpenChange={setShowRequestData}
          caseId={cases[0].id}
          clientId={client.id}
          clientData={client as Record<string, unknown>}
          caseData={cases[0] as Record<string, unknown>}
        />
      )}

      {/* Scan + Extraction Suggestions */}
      {allDocs.length > 0 && (
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanAll}
            disabled={scanning || pendingDocs.length === 0}
            className="gap-2"
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ScanSearch className="w-3.5 h-3.5" />
            )}
            {scanning ? scanProgress : `Escanear documentos com IA (${pendingDocs.length})`}
          </Button>
        </div>
      )}
      <ExtractionSuggestions clientId={client.id} />

      {/* Collapsible Sections */}
      <div className="space-y-3 mb-6">
        {/* Section 1: Dados Pessoais */}
        <Collapsible open={personalOpen} onOpenChange={setPersonalOpen}>
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeader icon={Users} title="Dados Pessoais" open={personalOpen} editing={editingPersonal}
              onToggle={() => setPersonalOpen(!personalOpen)} onEdit={startEditPersonal} />
            <CollapsibleContent>
              <div className="p-4">
                {editingPersonal ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">Nome completo</Label><Input value={personalForm.name} onChange={e => setPersonalForm(p => ({ ...p, name: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">CPF</Label><Input value={personalForm.cpf} onChange={e => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setPersonalForm(p => ({ ...p, cpf: d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2") }));
                      }} placeholder="000.000.000-00" className="mt-1" /></div>
                      <div><Label className="text-xs">RG</Label><Input value={personalForm.rg} onChange={e => setPersonalForm(p => ({ ...p, rg: e.target.value }))} className="mt-1" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">Nacionalidade</Label><Input value={personalForm.nationality} onChange={e => setPersonalForm(p => ({ ...p, nationality: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">Estado civil</Label>
                        <Select value={personalForm.marital_status} onValueChange={v => setPersonalForm(p => ({ ...p, marital_status: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {["solteiro(a)", "casado(a)", "divorciado(a)", "viúvo(a)", "união estável"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Profissão</Label><Input value={personalForm.profession} onChange={e => setPersonalForm(p => ({ ...p, profession: e.target.value }))} className="mt-1" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">E-mail</Label><Input value={personalForm.email} onChange={e => setPersonalForm(p => ({ ...p, email: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">Telefone</Label><Input value={personalForm.phone} onChange={e => setPersonalForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">Origem</Label>
                        <Select value={personalForm.origin} onValueChange={v => setPersonalForm(p => ({ ...p, origin: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {["Google Ads", "Indicação", "Instagram", "Outro"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingPersonal(false)}><X className="w-3.5 h-3.5 mr-1" />Cancelar</Button>
                      <Button size="sm" onClick={savePersonal} disabled={updateClient.isPending}>
                        {updateClient.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground">{cl.name}</span></div>
                    <div><span className="text-muted-foreground">CPF:</span> <span className="text-foreground">{cl.cpf || "—"}</span></div>
                    <div><span className="text-muted-foreground">RG:</span> <span className="text-foreground">{cl.rg || "—"}</span></div>
                    <div><span className="text-muted-foreground">Nacionalidade:</span> <span className="text-foreground">{cl.nationality || "—"}</span></div>
                    <div><span className="text-muted-foreground">Estado civil:</span> <span className="text-foreground">{cl.marital_status || "—"}</span></div>
                    <div><span className="text-muted-foreground">Profissão:</span> <span className="text-foreground">{cl.profession || "—"}</span></div>
                    <div><span className="text-muted-foreground">E-mail:</span> <span className="text-foreground">{cl.email || "—"}</span></div>
                    <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{cl.phone || "—"}</span></div>
                    <div><span className="text-muted-foreground">Origem:</span> <span className="text-foreground">{cl.origin || "—"}</span></div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Section 2: Endereço */}
        <Collapsible open={addressOpen} onOpenChange={setAddressOpen}>
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeader icon={MapPin} title="Endereço" open={addressOpen} editing={editingAddress}
              onToggle={() => setAddressOpen(!addressOpen)} onEdit={startEditAddress} />
            <CollapsibleContent>
              <div className="p-4">
                {editingAddress ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div><Label className="text-xs">CEP</Label><Input value={addressForm.address_zip} onChange={e => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                        const masked = v.length > 5 ? v.replace(/(\d{5})(\d)/, "$1-$2") : v;
                        setAddressForm(p => ({ ...p, address_zip: masked }));
                        if (v.length === 8) fetchCep(v);
                      }} placeholder="00000-000" className="mt-1" /></div>
                      <div className="col-span-2"><Label className="text-xs">Rua</Label><Input value={addressForm.address_street} onChange={e => setAddressForm(p => ({ ...p, address_street: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">Número</Label><Input value={addressForm.address_number} onChange={e => setAddressForm(p => ({ ...p, address_number: e.target.value }))} className="mt-1" /></div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div><Label className="text-xs">Complemento</Label><Input value={addressForm.address_complement} onChange={e => setAddressForm(p => ({ ...p, address_complement: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">Bairro</Label><Input value={addressForm.address_neighborhood} onChange={e => setAddressForm(p => ({ ...p, address_neighborhood: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">Cidade</Label><Input value={addressForm.address_city} onChange={e => setAddressForm(p => ({ ...p, address_city: e.target.value }))} className="mt-1" /></div>
                      <div><Label className="text-xs">Estado</Label><Input value={addressForm.address_state} onChange={e => setAddressForm(p => ({ ...p, address_state: e.target.value }))} className="mt-1" /></div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingAddress(false)}><X className="w-3.5 h-3.5 mr-1" />Cancelar</Button>
                      <Button size="sm" onClick={saveAddress} disabled={updateClient.isPending}>
                        {updateClient.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    {cl.address_street ? (
                      <p className="text-foreground">
                        {cl.address_street}, {cl.address_number || "S/N"}
                        {cl.address_complement ? `, ${cl.address_complement}` : ""} — {cl.address_neighborhood || ""}, {cl.address_city || ""}/{cl.address_state || ""} — CEP {cl.address_zip || ""}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Nenhum endereço cadastrado.</p>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Section 3: Filhos / Menores (only for relevant case types) */}
        {hasChildrenCases && (
          <Collapsible open={childrenOpen} onOpenChange={setChildrenOpen}>
            <div className="border border-border rounded-lg overflow-hidden">
              <SectionHeader icon={Baby} title="Filhos / Menores" open={childrenOpen}
                onToggle={() => setChildrenOpen(!childrenOpen)} />
              <CollapsibleContent>
                <div className="p-4 space-y-4">
                  {cases.filter(c => CHILDREN_CASE_TYPES.includes(c.case_type)).map(caseItem => {
                    const ci = caseItem as any;
                    const children: Child[] = ci.children || [];
                    const isEditing = editingChildren === caseItem.id;
                    return (
                      <div key={caseItem.id} className="border border-border/50 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">{caseItem.case_type} — {caseItem.description?.slice(0, 40)}</span>
                          {!isEditing && (
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => startEditChildren(ci)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            {childrenList.map((child, idx) => (
                              <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                                <div><Label className="text-xs">Nome</Label><Input value={child.name} onChange={e => setChildrenList(prev => prev.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))} className="mt-1 h-8 text-xs" /></div>
                                <div><Label className="text-xs">Data nasc.</Label><Input type="date" value={child.birth_date} onChange={e => setChildrenList(prev => prev.map((c, i) => i === idx ? { ...c, birth_date: e.target.value } : c))} className="mt-1 h-8 text-xs" /></div>
                                <div><Label className="text-xs">CPF (opcional)</Label><Input value={child.cpf || ""} onChange={e => setChildrenList(prev => prev.map((c, i) => i === idx ? { ...c, cpf: e.target.value } : c))} className="mt-1 h-8 text-xs" /></div>
                                <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => removeChild(idx)}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            ))}
                            <div className="grid grid-cols-4 gap-2 items-end border-t border-border/50 pt-2">
                              <div><Label className="text-xs">Nome</Label><Input value={newChild.name} onChange={e => setNewChild(p => ({ ...p, name: e.target.value }))} placeholder="Nome do filho" className="mt-1 h-8 text-xs" /></div>
                              <div><Label className="text-xs">Data nasc.</Label><Input type="date" value={newChild.birth_date} onChange={e => setNewChild(p => ({ ...p, birth_date: e.target.value }))} className="mt-1 h-8 text-xs" /></div>
                              <div><Label className="text-xs">CPF</Label><Input value={newChild.cpf || ""} onChange={e => setNewChild(p => ({ ...p, cpf: e.target.value }))} className="mt-1 h-8 text-xs" /></div>
                              <Button variant="outline" size="sm" className="h-8" onClick={addChild}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="ghost" size="sm" onClick={() => setEditingChildren(null)}><X className="w-3.5 h-3.5 mr-1" />Cancelar</Button>
                              <Button size="sm" onClick={saveChildren} disabled={updateCase.isPending}>
                                {updateCase.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          children.length > 0 ? (
                            <div className="space-y-1">
                              {children.map((child, idx) => (
                                <p key={idx} className="text-sm text-foreground">
                                  {child.name} — {child.birth_date ? new Date(child.birth_date).toLocaleDateString("pt-BR") : "sem data"}{child.cpf ? ` — CPF: ${child.cpf}` : ""}
                                </p>
                              ))}
                            </div>
                          ) : <p className="text-sm text-muted-foreground">Nenhum filho cadastrado.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Section 4: Parte Contrária */}
        {cases.length > 0 && (
          <Collapsible open={opposingOpen} onOpenChange={setOpposingOpen}>
            <div className="border border-border rounded-lg overflow-hidden">
              <SectionHeader icon={UserX} title="Parte Contrária" open={opposingOpen}
                onToggle={() => setOpposingOpen(!opposingOpen)} />
              <CollapsibleContent>
                <div className="p-4 space-y-4">
                  {cases.map(caseItem => {
                    const ci = caseItem as any;
                    const isEditing = editingOpposing === caseItem.id;
                    return (
                      <div key={caseItem.id} className="border border-border/50 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">{caseItem.case_type} — {caseItem.description?.slice(0, 40)}</span>
                          {!isEditing && (
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => startEditOpposing(ci)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div><Label className="text-xs">Nome</Label><Input value={opposingForm.opposing_party_name} onChange={e => setOpposingForm(p => ({ ...p, opposing_party_name: e.target.value }))} className="mt-1" /></div>
                              <div><Label className="text-xs">CPF</Label><Input value={opposingForm.opposing_party_cpf} onChange={e => setOpposingForm(p => ({ ...p, opposing_party_cpf: e.target.value }))} className="mt-1" /></div>
                              <div><Label className="text-xs">Endereço</Label><Input value={opposingForm.opposing_party_address} onChange={e => setOpposingForm(p => ({ ...p, opposing_party_address: e.target.value }))} className="mt-1" /></div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setEditingOpposing(null)}><X className="w-3.5 h-3.5 mr-1" />Cancelar</Button>
                              <Button size="sm" onClick={saveOpposing} disabled={updateCase.isPending}>
                                {updateCase.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          ci.opposing_party_name ? (
                            <p className="text-sm text-foreground">
                              {ci.opposing_party_name}{ci.opposing_party_cpf ? `, CPF: ${ci.opposing_party_cpf}` : ""}
                              {ci.opposing_party_address ? ` — ${ci.opposing_party_address}` : ""}
                            </p>
                          ) : <p className="text-sm text-muted-foreground">Nenhuma parte contrária cadastrada.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </div>

      {/* Tabs: Cases & Notes */}
      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Casos ({cases.length})</TabsTrigger>
          <TabsTrigger value="notes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Casos</h2>
            <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Novo caso</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo caso</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div><Label>Tipo</Label>
                    <Select value={caseForm.case_type} onValueChange={v => setCaseForm(f => ({ ...f, case_type: v }))}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{caseTypesList.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Descrição</Label>
                    <Textarea value={caseForm.description} onChange={e => setCaseForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o caso..." className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Número CNJ (opcional)</Label><Input value={caseForm.cnj_number} onChange={e => setCaseForm(f => ({ ...f, cnj_number: e.target.value }))} placeholder="0000000-00.0000.0.00.0000" className="mt-1.5" /></div>
                    <div><Label>Vara (opcional)</Label><Input value={caseForm.court} onChange={e => setCaseForm(f => ({ ...f, court: e.target.value }))} placeholder="Ex: 2a Vara de Família" className="mt-1.5" /></div>
                  </div>
                  <Button className="w-full" onClick={handleCreateCase} disabled={createCase.isPending}>{createCase.isPending ? "Criando..." : "Criar caso"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {cases.length === 0 ? (
            <div className="border border-border rounded-lg">
              <EmptyState icon={FolderOpen} title="Nenhum caso registrado" description="Crie o primeiro caso para este cliente." actionLabel="Novo caso" onAction={() => setCaseDialogOpen(true)} />
            </div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {cases.map(c => (
                <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.case_type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                    {c.cnj_number && <p className="text-xs text-muted-foreground mt-0.5">CNJ: {c.cnj_number}</p>}
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Textarea value={notes ?? client.notes ?? ""} onChange={e => setNotes(e.target.value)} placeholder="Anotações sobre o cliente..." className="min-h-[200px]" />
          <Button size="sm" className="mt-3" onClick={handleSaveNotes} disabled={updateClient.isPending}>Salvar</Button>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{client.name}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
