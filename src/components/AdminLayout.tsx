import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { QuickCreateCase } from "@/components/QuickCreateCase";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Search, X, Eye } from "lucide-react";
import { Outlet } from "react-router-dom";
import { useState } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useViewAs } from "@/hooks/use-view-as";

export default function AdminLayout() {
  usePushNotifications();
  const { isViewingAs, viewAsEmail, stopViewAs } = useViewAs();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {isViewingAs && (
            <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>Visualizando ambiente de <strong>{viewAsEmail}</strong></span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={stopViewAs}
              >
                <X className="w-3 h-3" />
                Voltar
              </Button>
            </div>
          )}
          <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
            <SidebarTrigger />
            <SearchTrigger />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <QuickCreateCase />
      <GlobalSearch />
    </SidebarProvider>
  );
}

function SearchTrigger() {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-2 text-muted-foreground font-normal px-3"
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
        );
      }}
    >
      <Search className="w-3.5 h-3.5" />
      <span className="hidden sm:inline text-xs">Buscar...</span>
      <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
        {isMac ? "⌘" : "Ctrl"}K
      </kbd>
    </Button>
  );
}
