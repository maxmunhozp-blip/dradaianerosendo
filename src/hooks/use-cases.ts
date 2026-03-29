import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CaseRow = Database["public"]["Tables"]["cases"]["Row"];
type CaseInsert = Database["public"]["Tables"]["cases"]["Insert"];

export function useCasesByClient(clientId: string) {
  return useQuery({
    queryKey: ["cases", "client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CaseRow[];
    },
    enabled: !!clientId,
  });
}

export function useCase(id: string) {
  return useQuery({
    queryKey: ["cases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, clients(name, cpf, email)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: CaseInsert) => {
      const { data, error } = await supabase
        .from("cases")
        .insert(c)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["cases", "client", data.client_id] });
    },
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CaseRow> & { id: string }) => {
      const { data, error } = await supabase
        .from("cases")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cases", vars.id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useDeleteCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}
