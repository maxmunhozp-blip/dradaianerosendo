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
  BellRing,
  Mail,
  Palette,
  MessageSquarePlus,
  ClipboardList,
} from "lucide-react";
import { useIntimacaoCount } from "@/hooks/use-intimacoes";
import { useSignedDocumentsCount } from "@/hooks/use-documents";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useMyPermissions } from "@/hooks/use-my-permissions";
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

interface NavItem {
  title: string;
  url: string;
  icon: any;
  permission?: string; // key from MyPermissions
}

const navItems: NavItem[] = [
  { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users, permission: "can_view_clients" },
  { title: "Documentos", url: "/documents", icon: FolderOpen, permission: "can_view_documents" },
  { title: "Agenda", url: "/agenda", icon: CalendarDays, permission: "can_view_cases" },
  { title: "Notificações", url: "/dashboard#assinaturas", icon: BellRing, permission: "can_view_documents" },
  { title: "Intimações", url: "/intimacoes", icon: Bell, permission: "can_view_cases" },
  { title: "Caixa de E-mail", url: "/mail", icon: Mail, permission: "can_access_settings" },
  { title: "LARA", url: "/lara", icon: Bot },
  { title: "Templates", url: "/templates", icon: FileStack, permission: "can_edit_documents" },
  { title: "Formatação", url: "/settings/document-branding", icon: Palette, permission: "can_access_settings" },
  { title: "Solicitações", url: "/solicitacoes", icon: MessageSquarePlus },
  { title: "Administrador", url: "/admin", icon: ShieldCheck, permission: "can_access_settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { signOut, user } = useAuth();
  const { data: intimacaoCount = 0 } = useIntimacaoCount();
  const { data: signedDocumentsCount = 0 } = useSignedDocumentsCount();
  const { data: perms } = useMyPermissions();

  const isActive = (path: string) => {
    if (path === "/dashboard") return currentPath === "/dashboard";
    return currentPath.startsWith(path);
  };

  const visibleItems = navItems.filter((item) => {
    if (!item.permission) return true;
    if (!perms) return false;
    return (perms as any)[item.permission] === true;
  });

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
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent relative"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-r before:bg-amber-500"
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.url === "/dashboard#assinaturas" && signedDocumentsCount > 0 && (
                        collapsed ? (
                          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-accent" />
                        ) : (
                          <span className="ml-auto bg-accent text-accent-foreground text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                            {signedDocumentsCount > 9 ? "9+" : signedDocumentsCount}
                          </span>
                        )
                      )}
                      {!collapsed && item.url === "/intimacoes" && intimacaoCount > 0 && (
                        <span className="ml-auto bg-accent text-accent-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
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
