import { useState } from "react";
import { useUsers, useSetUserRole, useRemoveUserRole, useUserPermissions, useUpdatePermission, type UserPermissions } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { useViewAs } from "@/hooks/use-view-as";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield, ShieldOff, Users, Loader2, ChevronDown, FolderOpen, UserCircle,
  FileText, Settings, Eye, PenLine, Briefcase, GraduationCap, Calculator,
  MonitorSmartphone, ClipboardList, Search, Plus, Trash2, Pencil, User,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

const ALL_PERM_KEYS: PermissionKeys[] = [
  "can_view_cases", "can_edit_cases", "can_view_clients", "can_edit_clients",
  "can_view_documents", "can_edit_documents", "can_access_settings",
];

const ICON_MAP: Record<string, any> = {
  Briefcase, GraduationCap, Calculator, ClipboardList, Search, User,
  Shield, Users, FileText, Settings, Eye, PenLine,
};

const ICON_OPTIONS = [
  { name: "User", icon: User },
  { name: "Briefcase", icon: Briefcase },
  { name: "GraduationCap", icon: GraduationCap },
  { name: "Calculator", icon: Calculator },
  { name: "ClipboardList", icon: ClipboardList },
  { name: "Search", icon: Search },
  { name: "Shield", icon: Shield },
  { name: "FileText", icon: FileText },
  { name: "Users", icon: Users },
  { name: "Eye", icon: Eye },
  { name: "PenLine", icon: PenLine },
  { name: "Settings", icon: Settings },
];

interface DBProfile {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  permissions: Record<PermissionKeys, boolean>;
  is_builtin: boolean;
}

function useProfiles() {
  return useQuery({
    queryKey: ["permission-profiles"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("permission_profiles" as any).select("*").order("is_builtin", { ascending: false }).order("name")) as any;
      if (error) throw error;
      return (data || []) as DBProfile[];
    },
  });
}

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  const { startViewAs } = useViewAs();
  const { data: users, isLoading } = useUsers();
  const { data: allPermissions } = useUserPermissions();
  const { data: profiles = [] } = useProfiles();
  const setRole = useSetUserRole();
  const removeRole = useRemoveUserRole();
  const updatePermission = useUpdatePermission();
  const queryClient = useQueryClient();

  const [openUsers, setOpenUsers] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    email: string;
    action: "set" | "remove";
    role?: "admin" | "advogado" | "client";
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<DBProfile | null>(null);

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

  const applyProfile = async (userId: string, profile: DBProfile) => {
    try {
      await Promise.all(
        ALL_PERM_KEYS.map((key) =>
          updatePermission.mutateAsync({ userId, field: key, value: !!profile.permissions[key] })
        )
      );
      toast.success(`Perfil "${profile.name}" aplicado com sucesso`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao aplicar perfil");
    }
  };

  const handleSetRole = (userId: string, email: string, role: "admin" | "advogado" | "client") => {
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
      case "advogado":
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Advogado</Badge>;
      case "client":
        return <Badge variant="secondary">Cliente</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Sem permissão</Badge>;
    }
  };

  const countActivePerms = (perms?: UserPermissions) => {
    if (!perms) return 0;
    return ALL_PERM_KEYS.filter((k) => (perms as any)[k] === true).length;
  };

  const detectProfile = (perms?: UserPermissions): string | null => {
    if (!perms) return null;
    for (const profile of profiles) {
      const matches = ALL_PERM_KEYS.every((k) => !!(profile.permissions as any)[k] === !!(perms as any)[k]);
      if (matches) return profile.name;
    }
    return null;
  };

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("permission_profiles" as any).delete().eq("id", id)) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles"] });
      toast.success("Perfil excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gerenciar Usuários</h1>
            <p className="text-sm text-muted-foreground">Controle de permissões e acessos do sistema</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingProfile(null); setShowProfileModal(true); }}>
          <Plus className="w-3.5 h-3.5" />
          Novo Perfil
        </Button>
      </div>

      {/* Custom profiles management */}
      {profiles.some((p) => !p.is_builtin) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Perfis personalizados</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {profiles.filter((p) => !p.is_builtin).map((profile) => {
              const IconComp = ICON_MAP[profile.icon || "User"] || User;
              return (
                <div key={profile.id} className="flex items-center gap-2 border rounded-lg p-2.5 group">
                  <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{profile.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{profile.description}</p>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingProfile(profile); setShowProfileModal(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteProfile.mutate(profile.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            const currentProfileName = detectProfile(perms);

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
                              {currentProfileName && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {currentProfileName}
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

                      {!isSelf && (
                        <div className="flex items-center gap-3 pb-4 border-b">
                          <Label className="text-xs text-muted-foreground w-24 shrink-0">Tipo de acesso:</Label>
                          <Select
                            value={u.role === "sem_role" ? undefined : u.role}
                            onValueChange={(val) =>
                              handleSetRole(u.user_id, u.email, val as "admin" | "advogado" | "client")
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
                              <SelectItem value="advogado">
                                <span className="flex items-center gap-1.5">
                                  <Briefcase className="w-3 h-3" /> Advogado
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

                      {/* Profile presets from DB */}
                      {!isSelf && (
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Perfis predefinidos</p>
                          <div className="grid grid-cols-3 gap-2">
                            {profiles.map((profile) => {
                              const isActive = currentProfileName === profile.name;
                              const IconComp = ICON_MAP[profile.icon || "User"] || User;
                              return (
                                <button
                                  key={profile.id}
                                  onClick={() => applyProfile(u.user_id, profile)}
                                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                                    isActive
                                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                      : "border-border hover:bg-muted/50"
                                  }`}
                                >
                                  <IconComp className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                  <span className={`text-xs font-medium ${isActive ? "text-primary" : ""}`}>{profile.name}</span>
                                  <span className="text-[10px] text-muted-foreground leading-tight">{profile.description}</span>
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

      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        editing={editingProfile}
      />
    </div>
  );
}

function ProfileModal({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: DBProfile | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<PermissionKeys, boolean>>({
    can_view_cases: false, can_edit_cases: false,
    can_view_clients: false, can_edit_clients: false,
    can_view_documents: false, can_edit_documents: false,
    can_access_settings: false,
  });
  const [selectedIcon, setSelectedIcon] = useState("User");
  const [saving, setSaving] = useState(false);

  // Reset form when opening
  const handleOpenChange = (v: boolean) => {
    if (v) {
      if (editing) {
        setName(editing.name);
        setDescription(editing.description || "");
        setSelectedIcon(editing.icon || "User");
        setPermissions({ ...permissions, ...editing.permissions });
      } else {
        setName("");
        setDescription("");
        setSelectedIcon("User");
        setPermissions({
          can_view_cases: false, can_edit_cases: false,
          can_view_clients: false, can_edit_clients: false,
          can_view_documents: false, can_edit_documents: false,
          can_access_settings: false,
        });
      }
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do perfil é obrigatório");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase.from("permission_profiles" as any).update({
          name: name.trim(),
          description: description.trim() || null,
          icon: selectedIcon,
          permissions,
        }).eq("id", editing.id)) as any;
        if (error) throw error;
        toast.success("Perfil atualizado!");
      } else {
        const { error } = await (supabase.from("permission_profiles" as any).insert({
          name: name.trim(),
          description: description.trim() || null,
          icon: selectedIcon,
          permissions,
          is_builtin: false,
        })) as any;
        if (error) throw error;
        toast.success("Perfil criado!");
      }
      queryClient.invalidateQueries({ queryKey: ["permission-profiles"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            {editing ? "Editar Perfil" : "Novo Perfil de Permissão"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do perfil *</Label>
            <Input className="h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Paralegal, Assistente..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input className="h-8 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do perfil" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((opt) => {
                const isActive = selectedIcon === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setSelectedIcon(opt.name)}
                    className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors ${
                      isActive ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <opt.icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Permissões</p>
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${group.color}`}>
                    <group.icon className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-medium">{group.label}</span>
                </div>
                {group.permissions.map((perm) => (
                  <div key={perm.key} className="flex items-center justify-between pl-8">
                    <Label className="text-[12px] font-normal">{perm.label}</Label>
                    <Switch
                      checked={permissions[perm.key as PermissionKeys]}
                      onCheckedChange={(val) => setPermissions((p) => ({ ...p, [perm.key]: val }))}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editing ? "Salvar alterações" : "Criar perfil"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
