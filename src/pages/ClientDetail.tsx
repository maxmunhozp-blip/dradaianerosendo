import { useParams, Link } from "react-router-dom";
import { getClientById, getCasesByClientId } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const client = getClientById(id!);
  const cases = getCasesByClientId(id!);

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/clients">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Voltar
        </Link>
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>CPF: {client.cpf}</span>
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> {client.phone}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" /> {client.email}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Origem: {client.origin}</p>
        </div>
      </div>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Casos ({cases.length})</TabsTrigger>
          <TabsTrigger value="notes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caso registrado.</p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {cases.map((c) => (
                <Link
                  key={c.id}
                  to={`/cases/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.case_type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                    {c.cnj_number && (
                      <p className="text-xs text-muted-foreground mt-0.5">CNJ: {c.cnj_number}</p>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Textarea
            defaultValue={client.notes}
            placeholder="Anotações sobre o cliente..."
            className="min-h-[200px]"
          />
          <Button size="sm" className="mt-3">Salvar</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
