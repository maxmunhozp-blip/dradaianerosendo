import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalProtectedRoute } from "@/components/PortalProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import PortalLayout from "@/components/PortalLayout";
import ClientPortalLayout from "@/components/ClientPortalLayout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import CaseDetail from "@/pages/CaseDetail";
import LaraPage from "@/pages/LaraPage";
import Documents from "@/pages/Documents";
import Agenda from "@/pages/Agenda";
import PortalHome from "@/pages/PortalHome";
import PortalDocs from "@/pages/PortalDocs";
import PortalChat from "@/pages/PortalChat";
import PortalProfile from "@/pages/PortalProfile";
import PortalLogin from "@/pages/PortalLogin";
import Login from "@/pages/Login";
import SettingsPage from "@/pages/Settings";
import UsersManagement from "@/pages/UsersManagement";
import Templates from "@/pages/Templates";
import Intimacoes from "@/pages/Intimacoes";
import MailPage from "@/pages/MailPage";
import NotFound from "./pages/NotFound.tsx";
import PublicDataRequest from "./pages/PublicDataRequest";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/dados/:token" element={<PublicDataRequest />} />

            {/* Protected admin routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
                <Route path="/cases/:id" element={<CaseDetail />} />
                <Route path="/lara" element={<LaraPage />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/users" element={<UsersManagement />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/intimacoes" element={<Intimacoes />} />
                <Route path="/mail" element={<MailPage />} />
              </Route>
            </Route>

            {/* Client portal — magic link (no auth) */}
            <Route element={<ClientPortalLayout />}>
              <Route path="/portal" element={<PortalHome />} />
              <Route path="/portal/docs" element={<PortalDocs />} />
              <Route path="/portal/lara" element={<PortalLara />} />
              <Route path="/portal/perfil" element={<PortalProfile />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
