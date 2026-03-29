import {
  LayoutDashboard,
  Users,
  FileText,
  Bot,
  FolderOpen,
  LogOut,
  Settings,
  CalendarDays,
  ShieldCheck,
  FileStack,
  Bell,
  Mail,
} from "lucide-react";
import { useIntimacaoCount } from "@/hooks/use-intimacoes";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Painel", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Documentos", url: "/documents", icon: FolderOpen },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Intimações", url: "/intimacoes", icon: Bell },
  { title: "E-mails", url: "/mail", icon: Mail },
  { title: "LARA", url: "/lara", icon: Bot },
  { title: "Templates", url: "/templates", icon: FileStack },
  { title: "Usuários", url: "/users", icon: ShieldCheck },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { signOut, user } = useAuth();
  const { data: intimacaoCount = 0 } = useIntimacaoCount();

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center">
            <FileText className="w-4 h-4 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div>
              <span className="text-sm font-semibold text-sidebar-primary">LexAI</span>
              <p className="text-[10px] text-sidebar-foreground">Gestão Jurídica</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent relative"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-r before:bg-amber-500"
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && item.url === "/intimacoes" && intimacaoCount > 0 && (
                        <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {intimacaoCount > 9 ? "9+" : intimacaoCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        {!collapsed && user && (
          <p className="text-[10px] text-sidebar-foreground/60 truncate">{user.email}</p>
        )}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
