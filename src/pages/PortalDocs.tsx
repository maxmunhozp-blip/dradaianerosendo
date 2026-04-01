import { useRef, useState } from "react";
import { usePortalSession } from "@/components/ClientPortalLayout";
import { createClient } from "@supabase/supabase-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, Loader2, FileX, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  solicitado: { bg: "#FEF3C7", text: "#92400E", label: "Pendente" },
  recebido: { bg: "#DBEAFE", text: "#1E40AF", label: "Em análise" },
  aprovado: { bg: "#D1FAE5", text: "#065F46", label: "Aprovado" },
  devolvido: { bg: "#FEE2E2", text: "#991B1B", label: "Devolvido" },
};

export default function PortalDocs() {
  const session = usePortalSession();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: cases = [] } = useQuery({
    queryKey: ["portal-docs-cases", session?.clientId],
    queryFn: async () => {
      const { data } = await pub.from("cases").select("id").eq("client_id", session!.clientId);
      return data || [];
    },
    enabled: !!session?.clientId,
  });

  const caseIds = cases.map(c => c.id);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["portal-docs-list", caseIds],
    queryFn: async () => {
      const { data } = await pub.from("documents").select("*").in("case_id", caseIds).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: caseIds.length > 0,
  });

  const pending = documents.filter(d => d.status === "solicitado");
  const sent = documents.filter(d => d.status !== "solicitado");

  const uploadMut = useMutation({
    mutationFn: async ({ file, caseId }: { file: File; caseId: string }) => {
      if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 10MB)");
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${caseId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await pub.storage.from("case-documents").upload(filePath, file);
      if (upErr) throw upErr;

      const { data: urlData } = pub.storage.from("case-documents").getPublicUrl(filePath);

      const { error: dbErr } = await pub.from("documents").insert({
        case_id: caseId,
        name: file.name,
        category: "pessoal",
        status: "recebido",
        uploaded_by: "cliente",
        file_url: urlData.publicUrl,
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      toast.success("Documento enviado!");
      queryClient.invalidateQueries({ queryKey: ["portal-docs-list"] });
      setUploadingDocId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar");
      setUploadingDocId(null);
    },
  });

  const handleUpload = (docId: string) => {
    setUploadingDocId(docId);
    fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caseIds[0]) return;
    uploadMut.mutate({ file, caseId: caseIds[0] });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-20 w-full rounded-xl mb-3" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />

      <p style={{ fontFamily: "var(--wizard-font-display)", fontSize: 20, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 20 }}>
        Documentos
      </p>

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#92400E", marginBottom: 10 }}>
            Pendentes ({pending.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map(doc => (
              <div key={doc.id} style={{
                background: "#fff", borderRadius: 12, padding: "14px 16px",
                border: "1px solid #FCD34D", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <FileX size={18} color="#92400E" />
                  <span style={{ fontSize: 14, color: "var(--wizard-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.name}
                  </span>
                </div>
                <button
                  onClick={() => handleUpload(doc.id)}
                  disabled={uploadMut.isPending}
                  style={{
                    background: "var(--wizard-accent)", color: "#fff", border: "none",
                    borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    fontFamily: "var(--wizard-font-body)", flexShrink: 0,
                  }}
                >
                  {uploadMut.isPending && uploadingDocId === doc.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Enviar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent */}
      {sent.length > 0 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--wizard-primary)", marginBottom: 10 }}>
            Enviados ({sent.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sent.map(doc => {
              const sc = statusColors[doc.status] || statusColors.recebido;
              return (
                <div key={doc.id} style={{
                  background: "#fff", borderRadius: 12, padding: "14px 16px",
                  border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <FileText size={18} color="#6B7280" />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, color: "var(--wizard-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.name}
                      </p>
                      <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                        {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    background: sc.bg, color: sc.text, fontSize: 12, fontWeight: 600,
                    padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
                  }}>
                    {sc.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {documents.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9CA3AF" }}>
          <FileText size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>Nenhum documento</p>
          <p style={{ fontSize: 13 }}>Documentos aparecerão aqui quando adicionados ao seu caso.</p>
        </div>
      )}
    </div>
  );
}
