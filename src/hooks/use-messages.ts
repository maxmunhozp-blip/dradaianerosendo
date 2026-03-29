import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export function useMessagesByCase(caseId: string) {
  return useQuery({
    queryKey: ["messages", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as MessageRow[];
    },
    enabled: !!caseId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msg: { case_id: string; role: string; content: string }) => {
      const { data, error } = await supabase
        .from("messages")
        .insert(msg)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["messages", data.case_id] });
    },
  });
}
