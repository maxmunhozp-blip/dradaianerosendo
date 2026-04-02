import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DocRow = Database["public"]["Tables"]["documents"]["Row"];
type DocInsert = Database["public"]["Tables"]["documents"]["Insert"];

export function useDocumentsByCase(caseId: string) {
  return useQuery({
    queryKey: ["documents", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocRow[];
    },
    enabled: !!caseId,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useSignedDocumentsCount() {
  return useQuery({
    queryKey: ["documents-count-signed"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("signature_status", "signed");

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useAllDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, cases(case_type, clients(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DocInsert) => {
      const { data, error } = await supabase
        .from("documents")
        .insert(doc)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["documents", data.case_id] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["documents-count-signed"] });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DocRow> & { id: string }) => {
      const { data, error } = await supabase
        .from("documents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["documents", data.case_id] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["documents-count-signed"] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, caseId, fileUrl }: { id: string; caseId: string; fileUrl: string | null }) => {
      // Delete file from storage if exists
      if (fileUrl) {
        const marker = "/object/public/case-documents/";
        const idx = fileUrl.indexOf(marker);
        if (idx !== -1) {
          const path = fileUrl.substring(idx + marker.length);
          await supabase.storage.from("case-documents").remove([path]);
        }
      }
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
      return caseId;
    },
    onSuccess: (caseId) => {
      qc.invalidateQueries({ queryKey: ["documents", caseId] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["documents-count-signed"] });
    },
  });
}

export function useUploadDocument() {
  return useMutation({
    mutationFn: async ({ file, caseId }: { file: File; caseId: string }) => {
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${caseId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("case-documents")
        .upload(filePath, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("case-documents")
        .getPublicUrl(filePath);
      return urlData.publicUrl;
    },
  });
}
