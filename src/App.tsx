import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import PortalAssistente from "@/pages/PortalAssistente";
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
import LaraSkills from "./pages/LaraSkills";
import DocumentBranding from "./pages/DocumentBranding";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (href.includes("whatsapp") || href.includes("wa.me")) {
        e.preventDefault();
        let finalUrl = href;
        if (!href.startsWith("https://wa.me/")) {
          const phoneMatch = href.match(/phone=(\d+)/) || href.match(/wa\.me\/(\d+)/);
          const textMatch = href.match(/text=([^&]+)/);
          if (phoneMatch) {
            finalUrl = "https://wa.me/" + phoneMatch[1] + (textMatch ? "?text=" + textMatch[1] : "");
          }
        }
        window.open(finalUrl, "_blank", "noopener,noreferrer");
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const originalOpen = window.open.bind(window);
    window.open = (url?: string | URL, target?: string, features?: string) => {
      if (typeof url === "string" && (url.includes("wa.me") || url.includes("whatsapp"))) {
        let finalUrl = url;
        if (!url.startsWith("https://wa.me/")) {
          const phoneMatch = url.match(/phone=(\d+)/) || url.match(/wa\.me\/(\d+)/);
          const textMatch = url.match(/text=([^&]+)/);
          if (phoneMatch) {
            finalUrl = "https://wa.me/" + phoneMatch[1] + (textMatch ? "?text=" + textMatch[1] : "");
          }
        }
        return originalOpen(finalUrl, "_blank", "noopener,noreferrer");
      }
      return originalOpen(url, target, features);
    };
    return () => { window.open = originalOpen; };
  }, []);

  return (
  <ErrorBoundary>
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
                <Route path="/settings/lara-skills" element={<LaraSkills />} />
                <Route path="/settings/document-branding" element={<DocumentBranding />} />
              </Route>
            </Route>

            {/* Client portal — magic link (no auth) */}
            <Route element={<ClientPortalLayout />}>
              <Route path="/portal" element={<PortalHome />} />
              <Route path="/portal/docs" element={<PortalDocs />} />
              <Route path="/portal/chat" element={<PortalChat />} />
              <Route path="/portal/assistente" element={<PortalAssistente />} />
              <Route path="/portal/perfil" element={<PortalProfile />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
