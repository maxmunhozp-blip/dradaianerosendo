import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_CASE_TYPES = ["Divórcio", "Guarda", "Alimentos", "Inventário", "Outro"];

export function useCaseTypes() {
  return useQuery({
    queryKey: ["case-types"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("settings" as any)
        .select("value")
        .eq("key", "case_types")
        .single()) as any;
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
        } catch {}
      }
      return DEFAULT_CASE_TYPES;
    },
    staleTime: 30_000,
  });
}
