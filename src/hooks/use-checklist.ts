import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ChecklistRow = Database["public"]["Tables"]["checklist_items"]["Row"];
type ChecklistInsert = Database["public"]["Tables"]["checklist_items"]["Insert"];

export function useChecklistByCase(caseId: string) {
  return useQuery({
    queryKey: ["checklist", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChecklistRow[];
    },
    enabled: !!caseId,
  });
}

export function useCreateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: ChecklistInsert) => {
      const { data, error } = await supabase
        .from("checklist_items")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["checklist", data.case_id] });
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done, case_id }: { id: string; done: boolean; case_id: string }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ done })
        .eq("id", id);
      if (error) throw error;
      return case_id;
    },
    onSuccess: (caseId) => {
      qc.invalidateQueries({ queryKey: ["checklist", caseId] });
    },
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, case_id }: { id: string; case_id: string }) => {
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return case_id;
    },
    onSuccess: (caseId) => {
      qc.invalidateQueries({ queryKey: ["checklist", caseId] });
    },
  });
}
