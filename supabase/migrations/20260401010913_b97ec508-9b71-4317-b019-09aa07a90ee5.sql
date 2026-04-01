
-- Create lara_skills table
CREATE TABLE public.lara_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_keywords TEXT[] DEFAULT '{}',
  system_instructions TEXT NOT NULL,
  actions_available TEXT[] DEFAULT '{}',
  specialty_tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_builtin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lara_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skills" ON public.lara_skills FOR ALL USING (user_id = auth.uid() OR is_builtin = true);

-- Seed builtin skills
INSERT INTO public.lara_skills (user_id, name, description, trigger_keywords, system_instructions, actions_available, specialty_tags, is_builtin) VALUES
(NULL, 'Gestora de Documentos', 'Identifica clientes com documentos pendentes e coordena cobrança', ARRAY['documentos pendentes','docs faltando','quais clientes','pendentes'], 'Quando perguntado sobre documentos pendentes, analise TODOS os clientes e casos. Liste: nome do cliente, caso, quais documentos estão faltando e há quantos dias. Ordene por urgência (mais antigos primeiro). Sempre ofereça ações: cobrar via WhatsApp individualmente ou em lote, criar lembrete, ou gerar relatório.', ARRAY['send_whatsapp','create_task','open_client'], ARRAY['geral'], true),
(NULL, 'Análise de Prazos', 'Monitora prazos e audiências próximas', ARRAY['prazos','audiências','vencendo','próxima semana','urgente'], 'Quando perguntado sobre prazos, identifique: audiências nos próximos 7 dias, prazos processuais vencendo, casos sem movimentação há mais de 30 dias. Ordene por urgência. Ofereça ações: agendar lembrete, enviar mensagem ao cliente, criar tarefa.', ARRAY['schedule_reminder','send_whatsapp','create_task'], ARRAY['geral'], true),
(NULL, 'Protocolo de Divórcio', 'Checklist e fluxo para divórcio consensual', ARRAY['divórcio','separação','dissolução'], 'Para divórcio consensual: verificar se há filhos menores (exige vara de família), verificar se há bens (listar partilha). Documentos obrigatórios: RG e CPF de ambos, certidão de casamento (menos de 90 dias), comprovante de residência, IPTU se houver imóvel. Prazo médio: 30-90 dias consensual, 180-365 dias litigioso.', ARRAY['generate_document','create_task','open_client'], ARRAY['família','divórcio'], true),
(NULL, 'Protocolo de Alimentos', 'Fluxo para ação de alimentos e revisional', ARRAY['alimentos','pensão','revisional','alimentante'], 'Para ações de alimentos: verificar renda do alimentante (3 últimos holerites ou IR), calcular necessidade do alimentando (idade, escola, plano de saúde). Documentos: certidão de nascimento do filho, comprovantes de despesas, renda do alimentante se disponível. Tutela de urgência: avaliar se cabe liminar — prazo para liminar 48-72h após distribuição.', ARRAY['generate_document','create_task','send_whatsapp'], ARRAY['família','alimentos'], true);
