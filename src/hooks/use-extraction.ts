import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ExtractionSuggestion {
  id: string;
  document_id: string;
  case_id: string;
  client_id: string;
  field_path: string;
  suggested_value: string;
  current_value: string | null;
  status: string;
  created_at: string;
}

// Friendly labels for field paths
export const fieldLabels: Record<string, string> = {
  "clients.name": "Nome completo",
  "clients.cpf": "CPF",
  "clients.rg": "RG",
  "clients.nationality": "Nacionalidade",
  "clients.profession": "Profissão",
  "clients.address_zip": "CEP",
  "clients.address_street": "Rua",
  "clients.address_number": "Número",
  "clients.address_complement": "Complemento",
  "clients.address_neighborhood": "Bairro",
  "clients.address_city": "Cidade",
  "clients.address_state": "Estado",
  "cases.opposing_party_name": "Nome da parte contrária",
  "cases.opposing_party_cpf": "CPF da parte contrária",
  "cases.opposing_party_address": "Endereço da parte contrária",
  "cases.children_add": "Filho(a)",
  "cases.description": "Informação do caso",
};

export function usePendingSuggestions(clientId: string) {
  return useQuery({
    queryKey: ["extraction-suggestions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extraction_suggestions")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExtractionSuggestion[];
    },
    enabled: !!clientId,
  });
}

export function useApplySuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suggestion: ExtractionSuggestion) => {
      const [table, field] = suggestion.field_path.split(".");

      if (field === "children_add") {
        // Add child to children JSONB array
        const childData = JSON.parse(suggestion.suggested_value);
        const { data: caseData } = await supabase
          .from("cases")
          .select("children")
          .eq("id", suggestion.case_id)
          .single();
        const current = (caseData?.children as any[]) || [];
        await supabase
          .from("cases")
          .update({ children: [...current, childData] } as any)
          .eq("id", suggestion.case_id);
      } else if (table === "clients") {
        await supabase
          .from("clients")
          .update({ [field]: suggestion.suggested_value } as any)
          .eq("id", suggestion.client_id);
      } else if (table === "cases") {
        await supabase
          .from("cases")
          .update({ [field]: suggestion.suggested_value } as any)
          .eq("id", suggestion.case_id);
      }

      // Mark as accepted
      const { error } = await supabase
        .from("extraction_suggestions")
        .update({ status: "accepted" })
        .eq("id", suggestion.id);
      if (error) throw error;
    },
    onSuccess: (_, suggestion) => {
      qc.invalidateQueries({ queryKey: ["extraction-suggestions", suggestion.client_id] });
      qc.invalidateQueries({ queryKey: ["client", suggestion.client_id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useRejectSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from("extraction_suggestions")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ["extraction-suggestions", clientId] });
    },
  });
}

export function useApplyAllSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suggestions: ExtractionSuggestion[]) => {
      for (const s of suggestions) {
        const [table, field] = s.field_path.split(".");
        if (field === "children_add") {
          const childData = JSON.parse(s.suggested_value);
          const { data: caseData } = await supabase
            .from("cases").select("children").eq("id", s.case_id).single();
          const current = (caseData?.children as any[]) || [];
          await supabase.from("cases").update({ children: [...current, childData] } as any).eq("id", s.case_id);
        } else if (table === "clients") {
          await supabase.from("clients").update({ [field]: s.suggested_value } as any).eq("id", s.client_id);
        } else if (table === "cases") {
          await supabase.from("cases").update({ [field]: s.suggested_value } as any).eq("id", s.case_id);
        }
        await supabase.from("extraction_suggestions").update({ status: "accepted" }).eq("id", s.id);
      }
      return suggestions[0]?.client_id;
    },
    onSuccess: (clientId) => {
      if (clientId) {
        qc.invalidateQueries({ queryKey: ["extraction-suggestions", clientId] });
        qc.invalidateQueries({ queryKey: ["client", clientId] });
        qc.invalidateQueries({ queryKey: ["cases"] });
      }
    },
  });
}

export function useProcessDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      caseId,
      clientId,
      fileUrl,
      fileName,
    }: {
      documentId: string;
      caseId: string;
      clientId: string;
      fileUrl: string;
      fileName: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("process-document", {
        body: {
          document_id: documentId,
          case_id: caseId,
          client_id: clientId,
          file_url: fileUrl,
          file_name: fileName,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["extraction-suggestions", vars.clientId] });
      qc.invalidateQueries({ queryKey: ["documents", vars.caseId] });
    },
  });
}
