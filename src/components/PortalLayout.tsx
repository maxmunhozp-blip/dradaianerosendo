import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, FileText, LayoutDashboard, FolderOpen, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PortalLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-secondary flex flex-col">
      <header className="border-b border-border bg-background shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">Dra. Daiane Rosendo</span>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
          <nav className="flex gap-1 -mb-px">
            <NavLink
              to="/portal"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Meu Caso
            </NavLink>
            <NavLink
              to="/portal/documents"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Documentos
            </NavLink>
            <NavLink
              to="/portal/assistente"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Sofia
            </NavLink>
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
