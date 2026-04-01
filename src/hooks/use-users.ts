import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserWithRole {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
}

export interface UserPermissions {
  id: string;
  user_id: string;
  can_view_cases: boolean;
  can_edit_cases: boolean;
  can_view_clients: boolean;
  can_edit_clients: boolean;
  can_view_documents: boolean;
  can_edit_documents: boolean;
  can_access_settings: boolean;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return data as UserWithRole[];
    },
  });
}

export function useUserPermissions() {
  return useQuery({
    queryKey: ["user-permissions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("user_permissions" as any).select("*")) as any;
      if (error) throw error;
      return (data || []) as UserPermissions[];
    },
  });
}

export function useUpdatePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, field, value }: { userId: string; field: string; value: boolean }) => {
      const { error } = await (supabase.from("user_permissions" as any) as any)
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-permissions"] }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "client" }) => {
      const { error } = await supabase.rpc("set_user_role", {
        _target_user_id: userId,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      qc.invalidateQueries({ queryKey: ["user-permissions"] });
    },
  });
}

export function useRemoveUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_user_role", {
        _target_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      qc.invalidateQueries({ queryKey: ["user-permissions"] });
    },
  });
}
