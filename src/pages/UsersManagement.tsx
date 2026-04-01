import { useState } from "react";
import { useUsers, useSetUserRole, useRemoveUserRole, useUserPermissions, useUpdatePermission, type UserPermissions } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { useViewAs } from "@/hooks/use-view-as";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, ShieldOff, Users, Loader2, ChevronDown, FolderOpen, UserCircle, FileText, Settings, Eye, PenLine, Briefcase, GraduationCap, Calculator, MonitorSmartphone } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const PERMISSION_GROUPS = [
  {
    label: "Casos",
    icon: FolderOpen,
    color: "text-blue-600 bg-blue-500/10",
    permissions: [
      { key: "can_view_cases", label: "Visualizar casos", icon: Eye },
      { key: "can_edit_cases", label: "Criar e editar casos", icon: PenLine },
    ],
  },
  {
    label: "Clientes",
    icon: UserCircle,
    color: "text-emerald-600 bg-emerald-500/10",
    permissions: [
      { key: "can_view_clients", label: "Visualizar clientes", icon: Eye },
      { key: "can_edit_clients", label: "Criar e editar clientes", icon: PenLine },
    ],
  },
  {
    label: "Documentos",
    icon: FileText,
    color: "text-violet-600 bg-violet-500/10",
    permissions: [
      { key: "can_view_documents", label: "Visualizar documentos", icon: Eye },
      { key: "can_edit_documents", label: "Upload e gerenciar documentos", icon: PenLine },
    ],
  },
  {
    label: "Configurações",
    icon: Settings,
    color: "text-amber-600 bg-amber-500/10",
    permissions: [
      { key: "can_access_settings", label: "Acessar configurações do sistema", icon: Settings },
    ],
  },
];

type PermissionKeys = "can_view_cases" | "can_edit_cases" | "can_view_clients" | "can_edit_clients" | "can_view_documents" | "can_edit_documents" | "can_access_settings";

interface ProfilePreset {
  label: string;
  icon: any;
  description: string;
  permissions: Record<PermissionKeys, boolean>;
}

const PROFILE_PRESETS: ProfilePreset[] = [
  {
    label: "Advogado",
    icon: Briefcase,
    description: "Acesso total a casos, clientes e documentos",
    permissions: {
      can_view_cases: true,
      can_edit_cases: true,
      can_view_clients: true,
      can_edit_clients: true,
      can_view_documents: true,
      can_edit_documents: true,
      can_access_settings: false,
    },
  },
  {
    label: "Estagiário",
    icon: GraduationCap,
    description: "Apenas visualização de casos e documentos",
    permissions: {
      can_view_cases: true,
      can_edit_cases: false,
      can_view_clients: true,
      can_edit_clients: false,
      can_view_documents: true,
      can_edit_documents: false,
      can_access_settings: false,
    },
  },
  {
    label: "Financeiro",
    icon: Calculator,
    description: "Acesso a clientes e documentos, sem casos",
    permissions: {
      can_view_cases: false,
      can_edit_cases: false,
      can_view_clients: true,
      can_edit_clients: true,
      can_view_documents: true,
      can_edit_documents: true,
      can_access_settings: false,
    },
  },
];

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  const { startViewAs } = useViewAs();
  const { data: users, isLoading } = useUsers();
  const { data: allPermissions } = useUserPermissions();
  const setRole = useSetUserRole();
  const removeRole = useRemoveUserRole();
  const updatePermission = useUpdatePermission();

  const [openUsers, setOpenUsers] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    email: string;
    action: "set" | "remove";
    role?: "admin" | "client";
  } | null>(null);

  const toggleUser = (id: string) =>
    setOpenUsers((p) => ({ ...p, [id]: !p[id] }));

  const getPerms = (userId: string): UserPermissions | undefined =>
    allPermissions?.find((p) => p.user_id === userId);

  const handleToggle = async (userId: string, field: string, value: boolean) => {
    try {
      await updatePermission.mutateAsync({ userId, field, value });
      toast.success("Permissão atualizada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar permissão");
    }
  };

  const applyPreset = async (userId: string, preset: ProfilePreset) => {
    try {
      const keys = Object.keys(preset.permissions) as PermissionKeys[];
      await Promise.all(
        keys.map((key) =>
          updatePermission.mutateAsync({ userId, field: key, value: preset.permissions[key] })
        )
      );
      toast.success(`Perfil "${preset.label}" aplicado com sucesso`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao aplicar perfil");
    }
  };

  const handleSetRole = (userId: string, email: string, role: "admin" | "client") => {
    setConfirmAction({ userId, email, action: "set", role });
  };

  const handleRemoveRole = (userId: string, email: string) => {
    setConfirmAction({ userId, email, action: "remove" });
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.action === "set" && confirmAction.role) {
        await setRole.mutateAsync({ userId: confirmAction.userId, role: confirmAction.role });
        toast.success(`Permissão "${confirmAction.role}" atribuída a ${confirmAction.email}`);
      } else {
        await removeRole.mutateAsync(confirmAction.userId);
        toast.success(`Permissão removida de ${confirmAction.email}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao alterar permissão");
    }
    setConfirmAction(null);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Admin</Badge>;
      case "client":
        return <Badge variant="secondary">Cliente</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Sem permissão</Badge>;
    }
  };

  const countActivePerms = (perms?: UserPermissions) => {
    if (!perms) return 0;
    return [
      perms.can_view_cases, perms.can_edit_cases,
      perms.can_view_clients, perms.can_edit_clients,
      perms.can_view_documents, perms.can_edit_documents,
      perms.can_access_settings,
    ].filter(Boolean).length;
  };

  const detectPreset = (perms?: UserPermissions): string | null => {
    if (!perms) return null;
    for (const preset of PROFILE_PRESETS) {
      const keys = Object.keys(preset.permissions) as PermissionKeys[];
      const matches = keys.every((k) => (perms as any)[k] === preset.permissions[k]);
      if (matches) return preset.label;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gerenciar Usuários</h1>
          <p className="text-sm text-muted-foreground">Controle de permissões e acessos do sistema</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {users?.map((u) => {
            const isSelf = u.user_id === currentUser?.id;
            const isOpen = openUsers[u.user_id] || false;
            const perms = getPerms(u.user_id);
            const activeCount = countActivePerms(perms);
            const currentPreset = detectPreset(perms);

            return (
              <Collapsible key={u.user_id} open={isOpen} onOpenChange={() => toggleUser(u.user_id)}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserCircle className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">{u.email}</p>
                              {isSelf && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">você</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {getRoleBadge(u.role)}
                              {currentPreset && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {currentPreset}
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {activeCount}/7 acessos ativos
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-[11px] text-muted-foreground">
                              Cadastro: {format(new Date(u.created_at), "dd/MM/yyyy")}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Último acesso: {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd/MM HH:mm") : "Nunca"}
                            </p>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-5">
                      {/* Ver Ambiente button */}
                      {!isSelf && (
                        <div className="flex items-center gap-3 pb-4 border-b">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => {
                              startViewAs(u.user_id, u.email);
                              toast.success(`Visualizando ambiente de ${u.email}`);
                            }}
                          >
                            <MonitorSmartphone className="w-3.5 h-3.5" />
                            Ver Ambiente do Usuário
                          </Button>
                        </div>
                      )}

                      {/* Role selector */}
                      {!isSelf && (
                        <div className="flex items-center gap-3 pb-4 border-b">
                          <Label className="text-xs text-muted-foreground w-24 shrink-0">Tipo de acesso:</Label>
                          <Select
                            value={u.role === "sem_role" ? undefined : u.role}
                            onValueChange={(val) =>
                              handleSetRole(u.user_id, u.email, val as "admin" | "client")
                            }
                          >
                            <SelectTrigger className="w-[160px] h-8 text-xs">
                              <SelectValue placeholder="Definir role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1.5">
                                  <Shield className="w-3 h-3" /> Admin
                                </span>
                              </SelectItem>
                              <SelectItem value="client">
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3 h-3" /> Cliente
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {u.role !== "sem_role" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:text-destructive gap-1"
                              onClick={() => handleRemoveRole(u.user_id, u.email)}
                            >
                              <ShieldOff className="w-3.5 h-3.5" />
                              Remover
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Profile presets */}
                      {!isSelf && (
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Perfis predefinidos</p>
                          <div className="grid grid-cols-3 gap-2">
                            {PROFILE_PRESETS.map((preset) => {
                              const isActive = currentPreset === preset.label;
                              return (
                                <button
                                  key={preset.label}
                                  onClick={() => applyPreset(u.user_id, preset)}
                                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                                    isActive
                                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                      : "border-border hover:bg-muted/50"
                                  }`}
                                >
                                  <preset.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                  <span className={`text-xs font-medium ${isActive ? "text-primary" : ""}`}>{preset.label}</span>
                                  <span className="text-[10px] text-muted-foreground leading-tight">{preset.description}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Granular permissions */}
                      <div className="space-y-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Permissões granulares</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {PERMISSION_GROUPS.map((group) => (
                            <div key={group.label} className="rounded-lg border p-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${group.color}`}>
                                  <group.icon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-medium">{group.label}</span>
                              </div>
                              <div className="space-y-2.5">
                                {group.permissions.map((perm) => {
                                  const isActive = perms ? (perms as any)[perm.key] === true : false;
                                  return (
                                    <div key={perm.key} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <perm.icon className="w-3 h-3 text-muted-foreground" />
                                        <Label className="text-[12px] font-normal cursor-pointer">{perm.label}</Label>
                                      </div>
                                      <Switch
                                        checked={isActive}
                                        disabled={isSelf}
                                        onCheckedChange={(val) => handleToggle(u.user_id, perm.key, val)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {isSelf && (
                        <p className="text-[11px] text-muted-foreground italic">
                          Você não pode alterar suas próprias permissões.
                        </p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

          {(!users || users.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhum usuário encontrado
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "set"
                ? `Deseja atribuir a permissão "${confirmAction.role}" ao usuário ${confirmAction.email}?`
                : `Deseja remover todas as permissões do usuário ${confirmAction?.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
