import { useState, useEffect, createContext, useContext } from "react";
import { Outlet, NavLink, useSearchParams, useNavigate } from "react-router-dom";
import { Home, FileText, MessageCircle, User, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

interface PortalSession {
  clientId: string;
  clientName: string;
  token: string;
}

const PortalSessionContext = createContext<PortalSession | null>(null);
export const usePortalSession = () => useContext(PortalSessionContext);

const NAV_ITEMS = [
  { to: "/portal", icon: Home, label: "Início", end: true },
  { to: "/portal/docs", icon: FileText, label: "Documentos" },
  { to: "/portal/assistente", icon: MessageCircle, label: "Falar" },
  { to: "/portal/perfil", icon: User, label: "Perfil" },
];

export default function ClientPortalLayout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authUser, setAuthUser] = useState<any>(null);

  // Check if current user is an authenticated admin (for "viewing as client" banner)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (authSession?.user) setAuthUser(authSession.user);
    });
  }, []);

  // Pending docs count for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["portal-pending-docs", session?.clientId],
    queryFn: async () => {
      const { data: cases } = await publicSupabase
        .from("cases")
        .select("id")
        .eq("client_id", session!.clientId);
      const caseIds = cases?.map(c => c.id) || [];
      if (caseIds.length === 0) return 0;
      const { count } = await publicSupabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("status", "solicitado")
        .in("case_id", caseIds);
      return count || 0;
    },
    enabled: !!session?.clientId,
  });

  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    let token = searchParams.get("token");
    if (!token) token = localStorage.getItem("portal_token");

    if (!token) {
      setError("Link inválido — solicite um novo link com a Dra. Daiane.");
      setLoading(false);
      return;
    }

    try {
      const { data: sessionData, error: sessionError } = await publicSupabase
        .from("client_sessions")
        .select("client_id, token, expires_at")
        .eq("token", token)
        .maybeSingle();

      if (sessionError || !sessionData) {
        setError("Link inválido — solicite um novo link com a Dra. Daiane.");
        setLoading(false);
        return;
      }

      if (new Date(sessionData.expires_at) < new Date()) {
        localStorage.removeItem("portal_token");
        setError("Link expirado — solicite um novo link com a Dra. Daiane.");
        setLoading(false);
        return;
      }

      const { data: clientData } = await publicSupabase
        .from("clients")
        .select("name")
        .eq("id", sessionData.client_id)
        .maybeSingle();

      localStorage.setItem("portal_token", token);

      if (searchParams.get("token")) {
        navigate("/portal", { replace: true });
      }

      setSession({
        clientId: sessionData.client_id,
        clientName: clientData?.name || "",
        token,
      });
    } catch {
      setError("Erro ao carregar sessão.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--wizard-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--wizard-font-body)",
      }}>
        <Loader2 className="animate-spin" size={32} color="var(--wizard-accent)" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--wizard-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: "var(--wizard-font-body)",
      }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "32px 24px",
          maxWidth: 400, textAlign: "center",
          boxShadow: "0 2px 16px rgba(0,0,0,.06)",
        }}>
          <AlertCircle size={48} color="#C53030" style={{ margin: "0 auto 16px" }} />
          <p style={{
            fontFamily: "var(--wizard-font-display)", fontSize: 20,
            fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 8,
          }}>
            Acesso indisponível
          </p>
          <p style={{ fontSize: 15, color: "#6B7280" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <PortalSessionContext.Provider value={session}>
      <div style={{
        minHeight: "100vh", background: "var(--wizard-bg)",
        fontFamily: "var(--wizard-font-body)",
        paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
      }}>
        {/* Admin banner */}
        {authUser && (
          <div style={{
            position: "sticky", top: 0, zIndex: 60,
            background: "#FEF3C7", padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid #F59E0B",
            fontFamily: "var(--wizard-font-body)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
              Você está visualizando o portal como cliente
            </span>
            <button
              onClick={() => navigate("/", { replace: true })}
              style={{
                background: "#92400E", color: "#fff", border: "none",
                borderRadius: 6, padding: "6px 14px", fontSize: 12,
                fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--wizard-font-body)",
              }}
            >
              Sair
            </button>
          </div>
        )}

        <Outlet />

        {/* Bottom Navigation */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: "calc(64px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "#fff", borderTop: "1px solid #E5E7EB",
          display: "flex", justifyContent: "space-around", alignItems: "center",
          zIndex: 50,
        }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                textDecoration: "none", padding: "8px 12px", minWidth: 64,
                color: isActive ? "var(--wizard-primary)" : "#718096",
                transition: "color .2s",
              })}
            >
              {({ isActive }) => (
                <>
                  <div style={{ position: "relative" }}>
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    {/* Badge for Documentos */}
                    {item.label === "Documentos" && pendingCount > 0 && (
                      <span style={{
                        position: "absolute", top: -4, right: -8,
                        background: "#DC2626", color: "#fff",
                        fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
                        borderRadius: 8, display: "flex", alignItems: "center",
                        justifyContent: "center", padding: "0 4px",
                      }}>
                        {pendingCount}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: isActive ? 700 : 500,
                    fontFamily: "var(--wizard-font-body)",
                  }}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </PortalSessionContext.Provider>
  );
}
