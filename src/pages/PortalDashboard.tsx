import { CaseStatusStepper } from "@/components/CaseStatusStepper";
import { Upload, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock portal data
const portalData = {
  clientName: "Maria",
  caseType: "Divórcio",
  caseStatus: "andamento" as const,
  pendingDocs: [
    { id: "1", name: "Escritura do imóvel", uploaded: false },
    { id: "2", name: "Documento do veículo", uploaded: false },
  ],
  timeline: [
    { text: "Petição protocolada no fórum", date: "25/01/2024" },
    { text: "Documentos pessoais recebidos", date: "22/01/2024" },
    { text: "Caso iniciado", date: "20/01/2024" },
  ],
};

export default function PortalDashboard() {
  return (
    <div className="min-h-screen bg-secondary">
      <header className="bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <p className="text-sm font-medium text-foreground">Portal do Cliente</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-foreground mb-1">
          Olá, {portalData.clientName}. Seu processo:
        </h1>
        <p className="text-sm text-muted-foreground mb-6">{portalData.caseType}</p>

        {/* Status stepper */}
        <div className="bg-background border border-border rounded-lg p-5 mb-6">
          <CaseStatusStepper currentStatus={portalData.caseStatus} />
        </div>

        {/* Pending documents */}
        <div className="bg-background border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-medium text-foreground mb-3">Documentos pendentes</h2>
          <div className="space-y-3">
            {portalData.pendingDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-foreground">{doc.name}</span>
                </div>
                <Button variant="outline" size="sm">
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Enviar
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-background border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-foreground mb-3">Atualizações recentes</h2>
          <div className="space-y-3">
            {portalData.timeline.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <Check className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
