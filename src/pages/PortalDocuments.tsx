import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

export default function PortalDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadCaseId, setUploadCaseId] = useState<string | null>(null);

  const { data: client } = useQuery({
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

  const { data: cases = [] } = useQuery({
    queryKey: ["portal-cases", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("client_id", client!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!client,
  });

  const caseIds = cases.map((c) => c.id);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["portal-documents-all", caseIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, cases(case_type)")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false });
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
      queryClient.invalidateQueries({ queryKey: ["portal-documents-all"] });
      setUploadCaseId(null);
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar: " + err.message);
      setUploadCaseId(null);
    },
  });

  const handleUploadClick = (caseId: string) => {
    setUploadCaseId(caseId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadCaseId) return;
    uploadMutation.mutate({ file, caseId: uploadCaseId });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered =
    statusFilter === "all"
      ? documents
      : documents.filter((d) => d.status === statusFilter);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            {documents.length} documento{documents.length !== 1 ? "s" : ""} no total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="solicitado">Solicitado</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="assinado">Assinado</SelectItem>
            </SelectContent>
          </Select>
          {cases.length === 1 && (
            <Button
              size="sm"
              onClick={() => handleUploadClick(cases[0].id)}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 mr-1.5" />
              )}
              Enviar
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum documento"
          description={
            statusFilter === "all"
              ? "Documentos aparecerão aqui quando forem adicionados ao seu caso."
              : "Nenhum documento com esse status."
          }
        />
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-background">
          {filtered.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-4 py-3 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {doc.cases?.case_type}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
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
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      Assinar
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload per case if multiple */}
      {cases.length > 1 && (
        <div className="mt-6 border border-border rounded-lg p-4 sm:p-5 bg-background">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Enviar documento
          </h3>
          <div className="flex flex-wrap gap-2">
            {cases.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                size="sm"
                onClick={() => handleUploadClick(c.id)}
                disabled={uploadMutation.isPending}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {c.case_type}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
