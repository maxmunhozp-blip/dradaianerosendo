import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Hearing {
  id: string;
  created_at: string;
  case_id: string;
  title: string;
  date: string;
  location: string | null;
  notes: string | null;
  status: "agendado" | "realizado" | "cancelado";
  alert_whatsapp: boolean;
  cases?: { case_type: string; client_id: string; clients?: { name: string; phone: string | null } };
}

export function useHearings() {
  return useQuery({
    queryKey: ["hearings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hearings")
        .select("*, cases(case_type, client_id, clients(name, phone))")
        .order("date", { ascending: true });
      if (error) throw error;
      return data as unknown as Hearing[];
    },
  });
}

export function useHearingsByCase(caseId: string) {
  return useQuery({
    queryKey: ["hearings", "case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hearings")
        .select("*, cases(case_type, client_id, clients(name, phone))")
        .eq("case_id", caseId)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as unknown as Hearing[];
    },
    enabled: !!caseId,
  });
}

export function useUpcomingHearings(limit = 5) {
  return useQuery({
    queryKey: ["hearings", "upcoming", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hearings")
        .select("*, cases(case_type, client_id, clients(name, phone))")
        .eq("status", "agendado")
        .gte("date", new Date().toISOString())
        .order("date", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data as unknown as Hearing[];
    },
  });
}

export function useCreateHearing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (h: {
      case_id: string;
      title: string;
      date: string;
      location?: string;
      notes?: string;
      alert_whatsapp?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("hearings")
        .insert(h)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["hearings"] });
      qc.invalidateQueries({ queryKey: ["hearings", "case", data.case_id] });
    },
  });
}

export function useUpdateHearing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; title?: string; date?: string; location?: string; notes?: string; alert_whatsapp?: boolean }) => {
      const { data, error } = await supabase
        .from("hearings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hearings"] });
    },
  });
}
