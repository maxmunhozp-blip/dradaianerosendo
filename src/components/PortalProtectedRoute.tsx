import { useEffect, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function PortalProtectedRoute() {
  const { user, isLoading } = useAuth();
  const linkedRef = useRef(false);

  useEffect(() => {
    if (!user || linkedRef.current) return;
    linkedRef.current = true;

    // Auto-link: if no client record has this user_id, find by email and link
    (async () => {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) return;

      const email = user.email;
      if (!email) return;

      // Use security definer RPC to bypass RLS
      await supabase.rpc("link_client_by_email", {
        _user_id: user.id,
        _email: email,
      });
    })();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/portal/login" replace />;

  return <Outlet />;
}
