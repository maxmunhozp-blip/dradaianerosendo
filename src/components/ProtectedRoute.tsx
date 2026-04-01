import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useMyPermissions } from "@/hooks/use-my-permissions";
import { Loader2 } from "lucide-react";

// Map routes to required permission keys
const routePermissions: Record<string, string> = {
  "/clients": "can_view_clients",
  "/documents": "can_view_documents",
  "/agenda": "can_view_cases",
  "/intimacoes": "can_view_cases",
  "/mail": "can_access_settings",
  "/templates": "can_edit_documents",
  "/settings": "can_access_settings",
  "/settings/document-branding": "can_access_settings",
  "/settings/lara-skills": "can_access_settings",
  "/users": "can_access_settings",
};

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const { data: perms, isLoading: permsLoading } = useMyPermissions();
  const location = useLocation();

  if (isLoading || permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Check route-level permission
  if (perms) {
    const path = location.pathname;
    // Find matching route (try exact first, then prefix)
    const requiredPerm =
      routePermissions[path] ||
      Object.entries(routePermissions).find(
        ([route]) => path.startsWith(route + "/")
      )?.[1];

    if (requiredPerm && !(perms as any)[requiredPerm]) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
