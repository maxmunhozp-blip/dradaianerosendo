import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  Briefcase,
  FileText,
  Calendar,
  Settings,
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  icon: typeof Users;
  href: string;
  group: "clients" | "cases" | "documents" | "pages";
}

const STATIC_PAGES: SearchResult[] = [
  { id: "p-dash", label: "Dashboard", icon: LayoutDashboard, href: "/", group: "pages" },
  { id: "p-clients", label: "Clientes", icon: Users, href: "/clients", group: "pages" },
  { id: "p-docs", label: "Documentos", icon: FolderOpen, href: "/documents", group: "pages" },
  { id: "p-agenda", label: "Agenda", icon: Calendar, href: "/agenda", group: "pages" },
  { id: "p-lara", label: "LARA", icon: MessageSquare, href: "/lara", group: "pages" },
  { id: "p-settings", label: "Configurações", icon: Settings, href: "/settings", group: "pages" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["search-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, cpf, email")
        .order("name")
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["search-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_type, status, clients(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["search-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, category, case_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      navigate(href);
    },
    [navigate]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar clientes, casos, documentos..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <Search className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
          </div>
        </CommandEmpty>

        {/* Clients */}
        <CommandGroup heading="Clientes">
          {clients.map((c) => (
            <CommandItem
              key={c.id}
              value={`cliente ${c.name} ${c.cpf || ""} ${c.email || ""}`}
              onSelect={() => handleSelect(`/clients/${c.id}`)}
            >
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{c.name}</span>
                {c.cpf && (
                  <span className="text-xs text-muted-foreground">{c.cpf}</span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Cases */}
        <CommandGroup heading="Casos">
          {cases.map((c: any) => (
            <CommandItem
              key={c.id}
              value={`caso ${c.case_type} ${c.clients?.name || ""} ${c.status}`}
              onSelect={() => handleSelect(`/cases/${c.id}`)}
            >
              <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{c.case_type}</span>
                <span className="text-xs text-muted-foreground">
                  {c.clients?.name} · {c.status}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Documents */}
        <CommandGroup heading="Documentos">
          {documents.map((d) => (
            <CommandItem
              key={d.id}
              value={`documento ${d.name} ${d.category}`}
              onSelect={() => handleSelect(`/cases/${d.case_id}`)}
            >
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{d.name}</span>
                <span className="text-xs text-muted-foreground">{d.category}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Pages */}
        <CommandGroup heading="Páginas">
          {STATIC_PAGES.map((p) => (
            <CommandItem
              key={p.id}
              value={`página ${p.label}`}
              onSelect={() => handleSelect(p.href)}
            >
              <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
