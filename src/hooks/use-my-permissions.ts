import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface MyPermissions {
  can_view_cases: boolean;
  can_edit_cases: boolean;
  can_view_clients: boolean;
  can_edit_clients: boolean;
  can_view_documents: boolean;
  can_edit_documents: boolean;
  can_access_settings: boolean;
}

const ALL_GRANTED: MyPermissions = {
  can_view_cases: true,
  can_edit_cases: true,
  can_view_clients: true,
  can_edit_clients: true,
  can_view_documents: true,
  can_edit_documents: true,
  can_access_settings: true,
};

const ALL_DENIED: MyPermissions = {
  can_view_cases: false,
  can_edit_cases: false,
  can_view_clients: false,
  can_edit_clients: false,
  can_view_documents: false,
  can_edit_documents: false,
  can_access_settings: false,
};

export function useMyPermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Check if user is admin — admins bypass permissions
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });

      if (isAdmin) return ALL_GRANTED;

      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error || !data) return ALL_DENIED;

      return {
        can_view_cases: data.can_view_cases,
        can_edit_cases: data.can_edit_cases,
        can_view_clients: data.can_view_clients,
        can_edit_clients: data.can_edit_clients,
        can_view_documents: data.can_view_documents,
        can_edit_documents: data.can_edit_documents,
        can_access_settings: data.can_access_settings,
      } as MyPermissions;
    },
    staleTime: 60_000,
  });
}
