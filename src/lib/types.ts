export interface Client {
  id: string;
  created_at: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  origin: string;
  status: "prospect" | "contrato" | "ativo" | "encerrado";
  notes: string;
}

export interface Case {
  id: string;
  created_at: string;
  client_id: string;
  case_type: "Divórcio" | "Guarda" | "Alimentos" | "Inventário" | "Outro";
  cnj_number: string | null;
  court: string | null;
  status: "documentacao" | "montagem" | "protocolo" | "andamento" | "encerrado";
  description: string;
}

export interface Document {
  id: string;
  created_at: string;
  case_id: string;
  name: string;
  category: "pessoal" | "assinado" | "processo" | "outro";
  status: "solicitado" | "recebido" | "assinado" | "usado";
  file_url: string;
  uploaded_by: "advogada" | "cliente";
  notes: string;
}

export interface ChecklistItem {
  id: string;
  created_at: string;
  case_id: string;
  label: string;
  done: boolean;
  required_by: string | null;
}

export interface Message {
  id: string;
  created_at: string;
  case_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: any[] | null;
}
