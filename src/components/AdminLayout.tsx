import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { QuickCreateCase } from "@/components/QuickCreateCase";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Outlet } from "react-router-dom";
import { useState } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function AdminLayout() {
  usePushNotifications();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
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
