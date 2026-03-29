import { useState } from "react";
import { useUsers, useSetUserRole, useRemoveUserRole } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Shield, ShieldOff, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const setRole = useSetUserRole();
  const removeRole = useRemoveUserRole();

  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    email: string;
    action: "set" | "remove";
    role?: "admin" | "client";
  } | null>(null);

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

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => {
                const isSelf = u.user_id === currentUser?.id;
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                      )}
                    </TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.last_sign_in_at
                        ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm")
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={u.role === "sem_role" ? undefined : u.role}
                            onValueChange={(val) =>
                              handleSetRole(u.user_id, u.email, val as "admin" | "client")
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
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
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveRole(u.user_id, u.email)}
                            >
                              <ShieldOff className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

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
