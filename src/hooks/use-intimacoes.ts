import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Intimacao {
  id: string;
  created_at: string;
  case_id: string | null;
  raw_email_subject: string;
  raw_email_body: string;
  raw_email_date: string | null;
  from_email: string | null;
  process_number: string | null;
  tribunal: string | null;
  movement_type: string | null;
  deadline_date: string | null;
  status: string;
  notes: string | null;
  gmail_message_id: string | null;
  ai_summary: string | null;
  cases?: { case_type: string; clients?: { name: string } };
}

export function useIntimacoes(statusFilter?: string) {
  return useQuery({
    queryKey: ["intimacoes", statusFilter],
    queryFn: async () => {
      let query = (supabase.from("intimacoes" as any) as any)
        .select("*, cases(case_type, clients(name))")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "todas") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Intimacao[];
    },
  });
}

export function useIntimacaoCount() {
  return useQuery({
    queryKey: ["intimacoes-count-novo"],
    queryFn: async () => {
      const { count, error } = await (supabase.from("intimacoes" as any) as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "novo");
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useUrgentIntimacoes(daysAhead = 7) {
  return useQuery({
    queryKey: ["intimacoes-urgent", daysAhead],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await (supabase.from("intimacoes" as any) as any)
        .select("*, cases(case_type, clients(name))")
        .not("deadline_date", "is", null)
        .lte("deadline_date", futureDate.toISOString().split("T")[0])
        .gte("deadline_date", new Date().toISOString().split("T")[0])
        .neq("status", "arquivado")
        .order("deadline_date", { ascending: true });

      if (error) throw error;
      return data as unknown as Intimacao[];
    },
  });
}

export function useUpdateIntimacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      status?: string;
      case_id?: string | null;
      notes?: string;
    }) => {
      const { data, error } = await (supabase.from("intimacoes" as any) as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intimacoes"] });
      qc.invalidateQueries({ queryKey: ["intimacoes-count-novo"] });
      qc.invalidateQueries({ queryKey: ["intimacoes-urgent"] });
    },
  });
}

export function useSubmitIntimacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      subject: string;
      body: string;
      from_email?: string;
      date?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("process-intimacao", {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intimacoes"] });
      qc.invalidateQueries({ queryKey: ["intimacoes-count-novo"] });
      qc.invalidateQueries({ queryKey: ["intimacoes-urgent"] });
    },
  });
}
