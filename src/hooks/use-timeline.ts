import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimelineEntry {
  id: string;
  case_id: string;
  created_at: string;
  event_date: string;
  type: "manual" | "automatic";
  status: string;
  title: string;
  description: string;
  responsible: string | null;
  source_email_id: string | null;
  pinned: boolean;
  file_urls: { name: string; url: string }[];
  updated_at: string | null;
  updated_by: string | null;
}

export function useTimeline(caseId: string) {
  return useQuery({
    queryKey: ["case-timeline", caseId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("case_timeline" as any)
        .select("*")
        .eq("case_id", caseId)
        .order("pinned", { ascending: false })
        .order("event_date", { ascending: false })) as any;
      if (error) throw error;
      return (data || []) as TimelineEntry[];
    },
    enabled: !!caseId,
  });
}

export function useCreateTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Partial<TimelineEntry> & { case_id: string }) => {
      const { data, error } = await (supabase
        .from("case_timeline" as any) as any)
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data as TimelineEntry;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["case-timeline", vars.case_id] });
    },
  });
}

export function useUpdateTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, case_id, ...updates }: Partial<TimelineEntry> & { id: string; case_id: string }) => {
      const { error } = await (supabase
        .from("case_timeline" as any) as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["case-timeline", vars.case_id] });
    },
  });
}

export function useDeleteTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, case_id }: { id: string; case_id: string }) => {
      const { error } = await (supabase
        .from("case_timeline" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["case-timeline", vars.case_id] });
    },
  });
}
