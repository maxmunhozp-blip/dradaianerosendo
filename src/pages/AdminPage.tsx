import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Mail, Shield, Settings } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import UsersManagement from "./UsersManagement";
import EmailSettings from "./EmailSettings";
import SettingsPage from "./Settings";

function AccessTab() {
  // Placeholder — will use permission profiles or expand later
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Perfis de Acesso</h2>
      <p className="text-sm text-muted-foreground">
        Gerencie os perfis de permissão diretamente na aba de Usuários, expandindo cada usuário para configurar suas permissões individuais.
      </p>
    </div>
  );
}

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "usuarios";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Administrador</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários, e-mails, acessos e configurações</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="usuarios" className="flex items-center gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex items-center gap-1.5 text-xs">
            <Mail className="w-3.5 h-3.5" />
            E-mails
          </TabsTrigger>
          <TabsTrigger value="acessos" className="flex items-center gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" />
            Acessos
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-1.5 text-xs">
            <Settings className="w-3.5 h-3.5" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-6">
          <UsersManagement />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <EmailSettings />
        </TabsContent>

        <TabsContent value="acessos" className="mt-6">
          <AccessTab />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <SettingsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
