import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CaseStatusStepper } from "@/components/CaseStatusStepper";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  FolderOpen,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  documentacao: "Documentação",
  montagem: "Montagem",
  protocolo: "Protocolo",
  andamento: "Em andamento",
  encerrado: "Encerrado",
};
function formatStatus(s: string) {
  return statusLabels[s] || s;
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    caseId: string;
    checklistId?: string;
  } | null>(null);

  // Client record
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["portal-client", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Cases
  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["portal-cases", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client,
  });

  // Realtime: listen for case status changes
  useEffect(() => {
    if (!client) return;
    const channel = supabase
      .channel("portal-case-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cases",
          filter: `client_id=eq.${client.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          if (updated.status !== old.status) {
            toast.info(`Status atualizado: ${formatStatus(updated.status)}`, {
              description: updated.case_type,
              duration: 8000,
            });
          }
          queryClient.invalidateQueries({ queryKey: ["portal-cases"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client, queryClient]);

  const caseIds = cases.map((c) => c.id);

  // Documents
  const { data: documents = [] } = useQuery({
    queryKey: ["portal-documents", caseIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: caseIds.length > 0,
  });

  // Checklist
  const { data: checklist = [] } = useQuery({
    queryKey: ["portal-checklist", caseIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .in("case_id", caseIds);
      if (error) throw error;
      return data;
    },
    enabled: caseIds.length > 0,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      caseId,
    }: {
      file: File;
      caseId: string;
    }) => {
      const filePath = `${caseId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("case-documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("case-documents")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("documents").insert({
        case_id: caseId,
        name: file.name,
        category: "pessoal",
        status: "recebido",
        uploaded_by: "cliente",
        file_url: urlData.publicUrl,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("Documento enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["portal-documents"] });
      queryClient.invalidateQueries({ queryKey: ["portal-checklist"] });
      setUploadTarget(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar: " + err.message);
      setUploadTarget(null);
    },
  });

  const handleUploadClick = (caseId: string, checklistId?: string) => {
    setUploadTarget({ caseId, checklistId });
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    uploadMutation.mutate({ file, caseId: uploadTarget.caseId });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isLoading = clientLoading || casesLoading;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <EmptyState
          icon={FileText}
          title="Conta não vinculada"
          description="Seu e-mail ainda não está vinculado a nenhum caso. Entre em contato com o escritório."
        />
      </div>
    );
  }

  const pendingChecklist = checklist.filter((c) => !c.done);

  // Build timeline from documents
  const timeline = documents
    .map((d) => ({
      text: `Documento "${d.name}" — ${d.status === "recebido" ? "recebido" : "solicitado"}`,
      date: d.created_at,
      type: "document" as const,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <h1 className="text-lg sm:text-xl font-semibold text-foreground mb-1">
        Olá, {client.name.split(" ")[0]}. Acompanhe seu processo.
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {cases.length === 1
          ? cases[0].case_type
          : `${cases.length} processos em andamento`}
      </p>

      {cases.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum caso encontrado"
          description="Não encontramos nenhum processo vinculado à sua conta."
        />
      )}

      {cases.map((caseItem) => (
        <div key={caseItem.id} className="mb-8">
          {cases.length > 1 && (
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              {caseItem.case_type}
            </h2>
          )}

          {/* Status stepper */}
          <div className="border border-border rounded-lg p-4 sm:p-5 mb-4 bg-background">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
              Status do processo
            </p>
            <CaseStatusStepper currentStatus={caseItem.status} />
          </div>

          {/* Pending documents */}
          {(() => {
            const casePending = pendingChecklist.filter(
              (c) => c.case_id === caseItem.id
            );
            if (casePending.length === 0) return null;
            return (
              <div className="border border-border rounded-lg p-4 sm:p-5 mb-4 bg-background">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Documentos pendentes ({casePending.length})
                </h3>
                <div className="divide-y divide-border">
                  {casePending.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2.5 gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          {item.label}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          handleUploadClick(caseItem.id, item.id)
                        }
                        disabled={uploadMutation.isPending}
                      >
                        {uploadMutation.isPending &&
                        uploadTarget?.checklistId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        <span className="hidden sm:inline">Enviar</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Documents for this case */}
          {(() => {
            const caseDocs = documents.filter(
              (d) => d.case_id === caseItem.id
            );
            if (caseDocs.length === 0) return null;
            return (
              <div className="border border-border rounded-lg p-4 sm:p-5 mb-4 bg-background">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Seus documentos ({caseDocs.length})
                </h3>
                <div className="divide-y divide-border">
                  {caseDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between py-2.5 gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString(
                              "pt-BR"
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={doc.status} />
                        {doc.status === "assinado" && doc.file_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                            asChild
                          >
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Assinar documento
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      ))}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="border border-border rounded-lg p-4 sm:p-5 bg-background">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Atualizações
          </h3>
          <div className="space-y-3">
            {timeline.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{item.text}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(item.date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
