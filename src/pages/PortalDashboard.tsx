import { useEffect, useState, useRef } from "react";
import { CaseStatusStepper } from "@/components/CaseStatusStepper";
import { Upload, Check, Clock, FileText, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalDashboard() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Get client record for this user
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

  // Get cases for this client
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

  // Get documents for all client cases
  const caseIds = cases.map((c) => c.id);
  const { data: documents = [], isLoading: docsLoading } = useQuery({
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

  // Get checklist items
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

  const uploadMutation = useMutation({
    mutationFn: async ({ file, caseId }: { file: File; caseId: string }) => {
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
      setUploadingDocId(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar documento: " + err.message);
      setUploadingDocId(null);
    },
  });

  const handleFileUpload = (caseId: string) => {
    setUploadingDocId(caseId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocId) return;
    uploadMutation.mutate({ file, caseId: uploadingDocId });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isLoading = clientLoading || casesLoading || docsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary">
        <header className="bg-background border-b border-border">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Portal do Cliente</p>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-secondary">
        <header className="bg-background border-b border-border">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Portal do Cliente</p>
            <button onClick={() => signOut()} className="text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-6 py-16">
          <EmptyState
            icon={FileText}
            title="Conta não vinculada"
            description="Seu e-mail ainda não está vinculado a nenhum caso. Entre em contato com o escritório."
          />
        </div>
      </div>
    );
  }

  const pendingDocs = documents.filter((d) => d.status === "solicitado");
  const receivedDocs = documents.filter((d) => d.status === "recebido");

  return (
    <div className="min-h-screen bg-secondary">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      <header className="bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
              <FileText className="w-3 h-3 text-accent-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Portal do Cliente</p>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-foreground mb-1">
          Olá, {client.name.split(" ")[0]}.
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {cases.length === 1
            ? `Seu processo: ${cases[0].case_type}`
            : `Você tem ${cases.length} processos em andamento`}
        </p>

        {/* Cases with status */}
        {cases.map((caseItem) => (
          <div key={caseItem.id} className="mb-6">
            {cases.length > 1 && (
              <h2 className="text-sm font-medium text-foreground mb-2">
                {caseItem.case_type}
              </h2>
            )}
            <div className="bg-background border border-border rounded-lg p-5 mb-4">
              <p className="text-xs text-muted-foreground mb-3">Status do processo</p>
              <CaseStatusStepper currentStatus={caseItem.status} />
            </div>

            {/* Checklist for this case */}
            {(() => {
              const caseChecklist = checklist.filter((cl) => cl.case_id === caseItem.id);
              if (caseChecklist.length === 0) return null;
              return (
                <div className="bg-background border border-border rounded-lg p-5 mb-4">
                  <h3 className="text-sm font-medium text-foreground mb-3">Documentos necessários</h3>
                  <div className="space-y-2">
                    {caseChecklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-1.5">
                        {item.done ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className={`text-sm ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Upload area for this case */}
            <div className="bg-background border border-border rounded-lg p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">Enviar documento</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFileUpload(caseItem.id)}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending && uploadingDocId === caseItem.id ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                )}
                Escolher arquivo
              </Button>
            </div>
          </div>
        ))}

        {/* Recent documents */}
        {receivedDocs.length > 0 && (
          <div className="bg-background border border-border rounded-lg p-5">
            <h2 className="text-sm font-medium text-foreground mb-3">
              Documentos enviados ({receivedDocs.length})
            </h2>
            <div className="space-y-2">
              {receivedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-sm text-foreground flex-1">{doc.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {cases.length === 0 && (
          <EmptyState
            icon={FileText}
            title="Nenhum caso encontrado"
            description="Não encontramos nenhum processo vinculado à sua conta."
          />
        )}
      </div>
    </div>
  );
}
