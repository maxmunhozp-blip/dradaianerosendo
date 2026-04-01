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
  const [isUploading, setIsUploading] = useState(false);

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

  const handleUpload = (docId: string) => {
    setUploadingDocId(docId);
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caseIds[0]) return;
    if (fileRef.current) fileRef.current.value = "";

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      setUploadingDocId(null);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress for UX (real upload doesn't provide progress with supabase-js)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${caseIds[0]}/${Date.now()}-${safeName}`;

      const { error: upErr } = await pub.storage.from("case-documents").upload(filePath, file);
      if (upErr) throw upErr;

      const { data: urlData } = pub.storage.from("case-documents").getPublicUrl(filePath);

      // If uploading for a pending doc, update it; otherwise create new
      if (uploadingDocId) {
        const existingDoc = documents.find(d => d.id === uploadingDocId);
        if (existingDoc) {
          await pub.from("documents").update({
            status: "recebido",
            uploaded_by: "cliente",
            file_url: urlData.publicUrl,
          }).eq("id", uploadingDocId);
        }
      } else {
        await pub.from("documents").insert({
          case_id: caseIds[0],
          name: file.name,
          category: "pessoal",
          status: "recebido",
          uploaded_by: "cliente",
          file_url: urlData.publicUrl,
        });
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        toast.success("Documento enviado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["portal-docs-list"] });
        queryClient.invalidateQueries({ queryKey: ["portal-pending-docs"] });
        setUploadingDocId(null);
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      toast.error(err.message || "Erro ao enviar");
      setUploadingDocId(null);
      setIsUploading(false);
      setUploadProgress(0);
    }
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

      <p style={{
        fontFamily: "var(--wizard-font-display)", fontSize: 20,
        fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 20,
      }}>
        Documentos
      </p>

      {/* Upload progress overlay */}
      {isUploading && (
        <div style={{
          background: "#fff", borderRadius: 12, padding: "20px 16px",
          border: "1px solid #E5E7EB", marginBottom: 16, textAlign: "center",
        }}>
          <div style={{
            width: "100%", height: 8, borderRadius: 4,
            background: "#E5E7EB", marginBottom: 12, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: "var(--wizard-accent)",
              width: `${Math.round(uploadProgress)}%`,
              transition: "width .3s ease",
            }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--wizard-primary)" }}>
            Enviando... {Math.round(uploadProgress)}%
          </p>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
            Não feche o aplicativo até concluir
          </p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: "#FFF5F5", borderRadius: 12, padding: "14px 16px",
            border: "1px solid #FEB2B2", marginBottom: 8,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#C53030", marginBottom: 10 }}>
              Aguardando envio ({pending.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pending.map(doc => (
                <div key={doc.id} style={{
                  background: "#fff", borderRadius: 10, padding: "12px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <FileX size={18} color="#C53030" />
                    <span style={{
                      fontSize: 14, color: "var(--wizard-primary)", fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {doc.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUpload(doc.id)}
                    disabled={isUploading}
                    style={{
                      background: "var(--wizard-accent)", color: "#fff", border: "none",
                      borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700,
                      cursor: isUploading ? "not-allowed" : "pointer",
                      opacity: isUploading ? 0.5 : 1,
                      display: "flex", alignItems: "center", gap: 6,
                      fontFamily: "var(--wizard-font-body)", flexShrink: 0,
                    }}
                  >
                    <Upload size={14} />
                    Enviar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sent */}
      {sent.length > 0 && (
        <div>
          <p style={{
            fontSize: 14, fontWeight: 700, color: "var(--wizard-primary)", marginBottom: 10,
          }}>
            Enviados ({sent.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sent.map(doc => {
              const sc = statusColors[doc.status] || statusColors.recebido;
              return (
                <div key={doc.id} style={{
                  background: "#fff", borderRadius: 12, padding: "14px 16px",
                  border: "1px solid #E5E7EB",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <FileText size={18} color="#6B7280" />
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, color: "var(--wizard-primary)", fontWeight: 500,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
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

      {/* Upload new document button */}
      {caseIds.length > 0 && !isUploading && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => { setUploadingDocId(null); fileRef.current?.click(); }}
            disabled={isUploading}
            style={{
              width: "100%", background: "#fff", border: "2px dashed #D1D5DB",
              borderRadius: 12, padding: "20px 16px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              fontFamily: "var(--wizard-font-body)",
            }}
          >
            <Upload size={22} color="#6B7280" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--wizard-primary)" }}>
              Enviar novo documento
            </span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              PDF, JPG ou PNG (máx. 10MB)
            </span>
          </button>
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
