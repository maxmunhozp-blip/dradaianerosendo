import { useAllDocuments } from "@/hooks/use-documents";
import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeletons";
import { Download, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Documents() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { data: allDocs = [], isLoading } = useAllDocuments();

  const filtered = allDocs.filter((d: any) => {
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchCategory = categoryFilter === "all" || d.category === categoryFilter;
    return matchStatus && matchCategory;
  });

  const categoryLabels: Record<string, string> = {
    pessoal: "Pessoal",
    assinado: "Assinado",
    processo: "Processo",
    outro: "Outro",
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {allDocs.length} documentos em todos os casos
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="solicitado">Solicitado</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="assinado">Assinado</SelectItem>
            <SelectItem value="usado">Usado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="pessoal">Pessoal</SelectItem>
            <SelectItem value="assinado">Assinado</SelectItem>
            <SelectItem value="processo">Processo</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : allDocs.length === 0 ? (
        <div className="border border-border rounded-lg">
          <EmptyState
            icon={FileText}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg">
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
          />
        </div>
      ) : (
        <div className="border border-border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Documento</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Caso</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Categoria</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Enviado por</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc: any) => (
                <tr key={doc.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{doc.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {doc.cases?.case_type} — {doc.cases?.clients?.name || ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{categoryLabels[doc.category] || doc.category}</td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {doc.uploaded_by === "advogada" ? "Advogada" : "Cliente"}
                  </td>
                  <td className="px-4 py-3">
                    {doc.file_url && doc.file_url !== "" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
