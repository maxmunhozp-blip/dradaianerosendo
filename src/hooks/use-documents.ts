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
