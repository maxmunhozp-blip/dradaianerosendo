import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getCaseById,
  getClientById,
  getDocumentsByCaseId,
  getChecklistByCaseId,
  getMessagesByCaseId,
} from "@/lib/mock-data";
import { CaseStatusStepper } from "@/components/CaseStatusStepper";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentRow } from "@/components/DocumentRow";
import { ChecklistItemRow } from "@/components/ChecklistItemRow";
import { LaraChat } from "@/components/LaraChat";
import { ArrowLeft, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message, ChecklistItem } from "@/lib/types";

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const caseData = getCaseById(id!);
  const client = caseData ? getClientById(caseData.client_id) : null;
  const documents = getDocumentsByCaseId(id!);
  const initialChecklist = getChecklistByCaseId(id!);
  const initialMessages = getMessagesByCaseId(id!);

  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newItem, setNewItem] = useState("");

  if (!caseData || !client) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Caso não encontrado.</p>
      </div>
    );
  }

  const toggleChecklist = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item))
    );
  };

  const deleteChecklistItem = (itemId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  };

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    const item: ChecklistItem = {
      id: `ch-new-${Date.now()}`,
      created_at: new Date().toISOString(),
      case_id: id!,
      label: newItem.trim(),
      done: false,
      required_by: null,
    };
    setChecklist((prev) => [...prev, item]);
    setNewItem("");
  };

  const handleSendMessage = (content: string) => {
    const userMsg: Message = {
      id: `m-${Date.now()}`,
      created_at: new Date().toISOString(),
      case_id: id!,
      role: "user",
      content,
      attachments: null,
    };
    const assistantMsg: Message = {
      id: `m-${Date.now() + 1}`,
      created_at: new Date().toISOString(),
      case_id: id!,
      role: "assistant",
      content: "Entendido. Vou analisar as informações do caso e preparar uma resposta detalhada.",
      attachments: null,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left column */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0" style={{ flex: "0 0 60%" }}>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to={`/clients/${client.id}`}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            {client.name}
          </Link>
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{caseData.case_type}</h1>
              <StatusBadge status={caseData.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{caseData.description}</p>
            {caseData.cnj_number && (
              <p className="text-xs text-muted-foreground mt-1">CNJ: {caseData.cnj_number}</p>
            )}
            {caseData.court && (
              <p className="text-xs text-muted-foreground">Vara: {caseData.court}</p>
            )}
          </div>
        </div>

        <div className="mb-8 border border-border rounded-lg p-4">
          <CaseStatusStepper currentStatus={caseData.status} />
        </div>

        {/* Documents */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground">Documentos</h2>
            <Button variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload
            </Button>
          </div>
          <div className="border border-border rounded-lg px-4">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhum documento.</p>
            ) : (
              documents.map((doc) => <DocumentRow key={doc.id} doc={doc} />)
            )}
          </div>
        </div>

        {/* Checklist */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">Checklist</h2>
          <div className="border border-border rounded-lg px-4">
            {checklist.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                onToggle={toggleChecklist}
                onDelete={deleteChecklistItem}
              />
            ))}
            <div className="flex items-center gap-2 py-3">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                placeholder="Adicionar item..."
                className="text-sm h-8"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={addChecklistItem}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right column - LARA chat */}
      <div className="border-l border-border" style={{ flex: "0 0 40%" }}>
        <LaraChat messages={messages} onSend={handleSendMessage} />
      </div>
    </div>
  );
}
