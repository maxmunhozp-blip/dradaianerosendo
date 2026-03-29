import type { Client, Case, Document, ChecklistItem, Message } from "./types";

export const mockClients: Client[] = [
  {
    id: "c1",
    created_at: "2024-01-15T10:00:00Z",
    name: "Maria Silva Santos",
    cpf: "123.456.789-00",
    phone: "(11) 98765-4321",
    email: "maria.silva@email.com",
    origin: "Google Ads",
    status: "ativo",
    notes: "Cliente indicada pela Dra. Ana. Caso urgente.",
  },
  {
    id: "c2",
    created_at: "2024-02-20T14:30:00Z",
    name: "João Pedro Oliveira",
    cpf: "987.654.321-00",
    phone: "(11) 91234-5678",
    email: "joao.oliveira@email.com",
    origin: "Indicação",
    status: "contrato",
    notes: "",
  },
  {
    id: "c3",
    created_at: "2024-03-05T09:15:00Z",
    name: "Ana Carolina Ferreira",
    cpf: "456.789.123-00",
    phone: "(21) 99876-5432",
    email: "ana.ferreira@email.com",
    origin: "Instagram",
    status: "prospect",
    notes: "Primeiro contato via DM.",
  },
  {
    id: "c4",
    created_at: "2024-03-10T16:00:00Z",
    name: "Roberto Carlos Mendes",
    cpf: "321.654.987-00",
    phone: "(11) 97654-3210",
    email: "roberto.mendes@email.com",
    origin: "Google Ads",
    status: "ativo",
    notes: "",
  },
  {
    id: "c5",
    created_at: "2023-11-20T11:00:00Z",
    name: "Patricia Lima Costa",
    cpf: "654.321.987-00",
    phone: "(11) 96543-2109",
    email: "patricia.costa@email.com",
    origin: "Indicação",
    status: "encerrado",
    notes: "Caso encerrado com acordo.",
  },
];

export const mockCases: Case[] = [
  {
    id: "cs1",
    created_at: "2024-01-20T10:00:00Z",
    client_id: "c1",
    case_type: "Divórcio",
    cnj_number: "1234567-89.2024.8.26.0001",
    court: "2a Vara de Família - Foro Central",
    status: "andamento",
    description: "Divórcio consensual com partilha de bens. Imóvel em São Paulo e veículo.",
  },
  {
    id: "cs2",
    created_at: "2024-02-25T14:30:00Z",
    client_id: "c2",
    case_type: "Guarda",
    cnj_number: null,
    court: null,
    status: "documentacao",
    description: "Guarda compartilhada de dois filhos menores.",
  },
  {
    id: "cs3",
    created_at: "2024-03-06T09:15:00Z",
    client_id: "c1",
    case_type: "Alimentos",
    cnj_number: null,
    court: "1a Vara de Família - Foro Regional",
    status: "montagem",
    description: "Revisão de alimentos para filha menor.",
  },
  {
    id: "cs4",
    created_at: "2024-03-12T16:00:00Z",
    client_id: "c4",
    case_type: "Inventário",
    cnj_number: "9876543-21.2024.8.26.0002",
    court: "3a Vara de Família - Foro Central",
    status: "protocolo",
    description: "Inventário extrajudicial. Dois herdeiros, imóvel e conta bancária.",
  },
];

export const mockDocuments: Document[] = [
  {
    id: "d1",
    created_at: "2024-01-22T10:00:00Z",
    case_id: "cs1",
    name: "RG - Maria Silva",
    category: "pessoal",
    status: "recebido",
    file_url: "#",
    uploaded_by: "cliente",
    notes: "",
  },
  {
    id: "d2",
    created_at: "2024-01-22T10:05:00Z",
    case_id: "cs1",
    name: "Certidão de Casamento",
    category: "pessoal",
    status: "recebido",
    file_url: "#",
    uploaded_by: "cliente",
    notes: "",
  },
  {
    id: "d3",
    created_at: "2024-01-25T14:00:00Z",
    case_id: "cs1",
    name: "Petição Inicial",
    category: "processo",
    status: "assinado",
    file_url: "#",
    uploaded_by: "advogada",
    notes: "Protocolada em 25/01/2024",
  },
  {
    id: "d4",
    created_at: "2024-02-26T09:00:00Z",
    case_id: "cs2",
    name: "Certidão de Nascimento - Filho 1",
    category: "pessoal",
    status: "solicitado",
    file_url: "",
    uploaded_by: "cliente",
    notes: "Aguardando envio do cliente",
  },
  {
    id: "d5",
    created_at: "2024-03-13T11:00:00Z",
    case_id: "cs4",
    name: "Certidão de Óbito",
    category: "pessoal",
    status: "recebido",
    file_url: "#",
    uploaded_by: "cliente",
    notes: "",
  },
];

export const mockChecklist: ChecklistItem[] = [
  { id: "ch1", created_at: "2024-01-20T10:00:00Z", case_id: "cs1", label: "RG e CPF das partes", done: true, required_by: null },
  { id: "ch2", created_at: "2024-01-20T10:00:00Z", case_id: "cs1", label: "Certidão de casamento atualizada", done: true, required_by: null },
  { id: "ch3", created_at: "2024-01-20T10:00:00Z", case_id: "cs1", label: "Escritura do imóvel", done: false, required_by: "cliente" },
  { id: "ch4", created_at: "2024-01-20T10:00:00Z", case_id: "cs1", label: "Documento do veículo", done: false, required_by: "cliente" },
  { id: "ch5", created_at: "2024-01-20T10:00:00Z", case_id: "cs1", label: "Acordo de partilha assinado", done: false, required_by: "advogada" },
  { id: "ch6", created_at: "2024-02-25T14:30:00Z", case_id: "cs2", label: "Certidões de nascimento dos filhos", done: false, required_by: "cliente" },
  { id: "ch7", created_at: "2024-02-25T14:30:00Z", case_id: "cs2", label: "Comprovante de residência", done: false, required_by: "cliente" },
];

export const mockMessages: Message[] = [
  {
    id: "m1",
    created_at: "2024-03-15T10:00:00Z",
    case_id: "cs1",
    role: "user",
    content: "LARA, preciso redigir uma petição de divórcio consensual. O casal tem um imóvel e um veículo.",
    attachments: null,
  },
  {
    id: "m2",
    created_at: "2024-03-15T10:00:30Z",
    case_id: "cs1",
    role: "assistant",
    content: "Entendido. Para a petição de divórcio consensual com partilha de bens, vou precisar das seguintes informações:\n\n1. Dados completos de ambas as partes (nome, CPF, RG, endereço)\n2. Data e local do casamento\n3. Se há filhos menores ou incapazes\n4. Descrição detalhada dos bens (imóvel: matrícula, endereço; veículo: marca, modelo, placa)\n5. Como desejam dividir os bens\n\nVocê já tem essas informações disponíveis?",
    attachments: null,
  },
  {
    id: "m3",
    created_at: "2024-03-15T10:02:00Z",
    case_id: "cs1",
    role: "user",
    content: "Sim, tenho todos os dados. O imóvel fica com a esposa e o veículo com o marido.",
    attachments: null,
  },
];

export function getClientById(id: string) {
  return mockClients.find((c) => c.id === id);
}

export function getCasesByClientId(clientId: string) {
  return mockCases.filter((c) => c.client_id === clientId);
}

export function getCaseById(id: string) {
  return mockCases.find((c) => c.id === id);
}

export function getDocumentsByCaseId(caseId: string) {
  return mockDocuments.filter((d) => d.case_id === caseId);
}

export function getChecklistByCaseId(caseId: string) {
  return mockChecklist.filter((ch) => ch.case_id === caseId);
}

export function getMessagesByCaseId(caseId: string) {
  return mockMessages.filter((m) => m.case_id === caseId);
}
