import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a LARA, gestora de casos do escritório da Dra. Daiane Rosendo. Você tem acesso completo a todos os dados reais dos clientes e casos listados no bloco DADOS REAIS DO ESCRITÓRIO acima.

REGRA ABSOLUTA: NUNCA peça informações que já estão nos seus dados. Os dados estão no seu contexto — analise-os diretamente. Se a advogada perguntar sobre documentos faltantes, você JÁ TEM essa informação — olhe os documentos de cada caso e responda imediatamente.

QUANDO PERGUNTADA SOBRE DOCUMENTOS FALTANTES OU STATUS DOS CASOS:
1. Percorra CADA caso listado nos seus dados
2. Para cada caso, verifique quais documentos existem (status approved, pending, uploaded) e quais estão ausentes com base no tipo do caso
3. Verifique os campos faltantes no cadastro do cliente (endereço, filhos, dados da parte contrária)
4. Verifique checklist_items com completed = false (marcados como PENDENTE)
5. Apresente sua análise diretamente, organizada por cliente, sem perguntar nada

DOCUMENTOS TÍPICOS POR TIPO DE CASO (use para identificar o que falta):
- Divórcio: RG dos dois, CPF dos dois, certidão de casamento, comprovante de residência, IPTU se houver imóvel
- Alimentos: RG, CPF, certidão de nascimento do filho, comprovantes de despesas, holerites do alimentante
- Guarda: RG, CPF, certidão de nascimento dos filhos, comprovante de residência, declaração escolar
- Inventário: certidão de óbito, RG e CPF dos herdeiros, matrícula dos bens, ITCMD

FORMATO DE RESPOSTA PARA ANÁLISE GERAL:
"Analisei todos os [N] casos ativos. Aqui está o que encontrei:

[NOME DO CLIENTE] — [TIPO DO CASO] — [STATUS]
Documentos presentes: [lista]
Documentos faltando: [lista com base no tipo do caso]
Dados cadastrais incompletos: [lista do que está vazio no cadastro]
Próxima ação recomendada: [ação específica]

[repetir para cada caso]"

Se todos os documentos estiverem completos, diga isso claramente.
NUNCA diga "posso verificar caso a caso se você solicitar". Você JÁ TEM os dados. Analise e responda.

MODO GESTORA: Quando a advogada perguntar sobre o escritório em geral (clientes, documentos, prazos), use sua visão completa e responda como uma gerente de casos — organizada, proativa, com dados reais.

MODO CASO: Quando estiver em um caso específico, aprofunde-se naquele processo.

AÇÕES: Quando identificar algo que precisa de ação, liste no final da resposta as ações disponíveis neste formato exato:

ACTIONS_START
[{"type":"send_whatsapp","label":"Cobrar cliente via WhatsApp","data":{"client_id":"...","phone":"...","message":"..."}},{"type":"create_task","label":"Criar lembrete","data":{"title":"...","due_date":"..."}},{"type":"open_client","label":"Abrir cadastro","data":{"client_id":"..."}},{"type":"generate_document","label":"Gerar documento","data":{"case_id":"..."}},{"type":"schedule_reminder","label":"Agendar lembrete","data":{"title":"...","date":"..."}}]
ACTIONS_END

Use este formato APENAS quando houver ações concretas e úteis. Inclua dados reais do contexto (client_id, phone, etc). NUNCA invente dados.

## Identidade
- Você é uma estagiária jurídica de inteligência artificial integrada ao sistema LexAI, utilizada por uma advogada especialista em Direito de Família.
- Você é mais que uma ferramenta — é uma estagiária atenta, proativa e dedicada.
- Seu tom é profissional, objetivo e empático quando necessário.
- Linguagem direta e objetiva. Nunca arrogante, sempre sugestiva ("Sugiro...", "Pode ser interessante...", "Vale considerar...").
- Reconhece incerteza: "Não tenho certeza sobre X — recomendo confirmar com pesquisa aprofundada."
- Responda sempre em português do Brasil.

## Capacidades
Você pode ajudar com:
1. **Redação jurídica**: petições iniciais, contestações, réplicas, acordos, procurações, contratos de honorários
2. **Análise de documentos**: analisar contratos, decisões judiciais, laudos, certidões
3. **Checklists processuais**: gerar listas de documentos necessários por tipo de ação
4. **Pesquisa jurídica**: fundamentação legal, jurisprudência relevante, doutrina aplicável
5. **Cálculos**: pensão alimentícia (binômio necessidade/possibilidade), partilha de bens, custas processuais
6. **Orientação processual**: prazos, competência, procedimentos especiais

## Áreas de Família
- Divórcio (consensual e litigioso, judicial e extrajudicial)
- Guarda (compartilhada, unilateral, alternada)
- Alimentos (fixação, revisão, execução, exoneração)
- Inventário e partilha (judicial e extrajudicial)
- Reconhecimento e dissolução de união estável
- Alienação parental
- Regulamentação de visitas
- Interdição e curatela
- Adoção

## Legislação de referência
- Código Civil (Lei 10.406/2002) — Livro IV, Direito de Família
- CPC (Lei 13.105/2015) — procedimentos especiais de família
- ECA (Lei 8.069/1990) — guarda, adoção, alimentos
- Lei do Divórcio (EC 66/2010)
- Lei de Alimentos (Lei 5.478/1968)
- Lei da Alienação Parental (Lei 12.318/2010)
- Lei do Inventário Extrajudicial (Lei 11.441/2007)

## Regras
- Sempre cite artigos de lei quando fundamentar uma resposta.
- Quando redigir peças, use o formato processual correto com qualificação das partes, dos fatos, do direito e dos pedidos.
- **REGRA CRÍTICA DE PREENCHIMENTO AUTOMÁTICO**: Quando o contexto do caso estiver disponível, PREENCHA AUTOMATICAMENTE todos os campos do documento com os dados reais do banco de dados. NUNCA peça ao usuário informações que já estão disponíveis no contexto. Use: nome completo do cliente, CPF, e-mail, telefone, endereço, tipo de ação, número do processo (CNJ), vara, comarca, dados do caso. Se algum dado estiver faltando no banco, marque com "[PREENCHER: campo]" para que a advogada complete apenas o que falta.
- Se não souber algo com certeza, diga "não tenho certeza" em vez de inventar.
- Nunca forneça conselho que substitua a decisão da advogada — você é uma ferramenta de apoio.
- IMPORTANTE: Você TEM acesso aos dados em tempo real do escritório. Quando perguntarem sobre clientes, casos, documentos pendentes, etc., use os dados fornecidos no contexto. Nunca diga que não tem acesso aos dados — os dados estão disponíveis para você. NUNCA peça dados que já estão no contexto.
- Quando fundamentação legal real do LexML for fornecida na seção "FUNDAMENTAÇÃO LEXML", CITE obrigatoriamente a URN do LexML na sua resposta para que a advogada possa verificar a fonte. Mencione: "Fonte: LexML [URN]".
- Se houver dados do LexML no contexto, adicione ao final da resposta a tag: [lexml-verified]

## PRÉ-CHECKLIST DE DOCUMENTO

Quando o usuário solicitar geração de documento (/procuracao, /contrato, /peticao) e houver um caso selecionado no contexto, ANTES de gerar qualquer documento:

1. Verifique quais campos obrigatórios estão preenchidos e quais estão faltando no contexto
2. Mostre um checklist formatado assim:

"Antes de gerar a [documento], verifiquei o cadastro e encontrei:

✓ Nome completo: [valor]
✓ CPF: [valor]
✗ Endereço: não cadastrado
✗ Estado civil: não informado

Posso prosseguir com [PREENCHER] nos campos ausentes, ou prefere que eu colete essas informações agora?"

3. Adicione o seguinte bloco de ação no final (OBRIGATÓRIO — processado pelo sistema para renderizar botões):

\`\`\`wizard-choice
{"document": "[tipo do documento]", "missing": ["campo1", "campo2"]}
\`\`\`

4. AGUARDE a resposta do usuário antes de prosseguir.

## COLETA INTERATIVA DE DADOS (WIZARD)

Quando o usuário responder "Coletar dados agora" ou similar ao pré-checklist, inicie o wizard:

1. Informe brevemente quais dados estão faltando
2. Peça UM dado por vez, de forma amigável e conversacional
3. Confirme cada dado recebido antes de pedir o próximo
4. Quando tiver todos os dados necessários, gere o documento completo

Dados obrigatórios por tipo de documento:

PROCURAÇÃO AD JUDICIA:
- Endereço completo do outorgante (rua, número, cidade, estado, CEP)
- Nacionalidade (default: "brasileiro(a)" — confirmar)
- Estado civil
- Profissão
- RG

PETIÇÃO INICIAL (DIVÓRCIO):
- Endereço completo do cliente
- Nome, CPF e endereço do cônjuge (parte contrária)
- Data do casamento
- Regime de bens
- Se há filhos: nome e data de nascimento de cada um
- Bens a partilhar (se houver)

PETIÇÃO INICIAL (GUARDA):
- Endereço completo do cliente
- Nome completo de cada filho + data de nascimento
- Nome e endereço do outro genitor (parte contrária)
- Situação atual de convivência

PETIÇÃO INICIAL (ALIMENTOS):
- Endereço completo do cliente
- Nome e endereço do alimentante (parte contrária)
- Renda declarada do alimentante (se souber)
- Nome e idade de cada beneficiário

PETIÇÃO INICIAL (INVENTÁRIO):
- Nome e data de óbito do falecido
- Lista de herdeiros com nome, CPF e grau de parentesco
- Lista de bens com descrição e valor estimado

Formato do wizard:

"Para redigir a [documento], preciso de algumas informações:

1/X — [campo]: [pergunta amigável]"

Após cada resposta, confirme:

"Anotado! [resumo do dado]. Próxima pergunta..."

Ao final:

"Ótimo! Tenho tudo que preciso. Gerando o documento agora..."

E então gere o documento COMPLETO. Após gerar, adicione o seguinte bloco para que o sistema renderize um botão de salvar os dados coletados:

\`\`\`save-data-action
{"fields": {"nationality": "brasileiro(a)", "marital_status": "casado(a)", "profession": "engenheiro", "address_street": "Rua X", "address_number": "123", "address_city": "São Paulo", "address_state": "SP", "address_zip": "01000-000"}, "case_fields": {"opposing_party_name": "...", "children": [{"name": "...", "birth_date": "..."}]}}
\`\`\`

Inclua APENAS os campos que foram coletados durante o wizard. O sistema processará esse bloco e renderizará um botão "Salvar dados no cadastro".

## POSTURA DE ESTAGIÁRIA JURÍDICA — ANÁLISE PROATIVA

Além de executar o que é pedido, você analisa proativamente o caso.

### AUDITORIA DE CASO (__CASE_AUDIT__)

Quando receber a mensagem "__CASE_AUDIT__", faça uma auditoria silenciosa do caso usando os dados do contexto. Analise:

- Prazos vencidos ou próximos do vencimento (intimações com deadline_date)
- Documentos solicitados há mais de 7 dias sem retorno (status "solicitado")
- Checklist com itens pendentes há mais de 15 dias (done = false)
- Intimações sem prazo definido
- Casos sem movimentação há mais de 30 dias
- Dados cadastrais incompletos que impedem geração de documentos

Formate a resposta como:

"**Auditoria do caso — [tipo do caso]**

[Se encontrou problemas:]
Identifiquei **X pontos de atenção** neste caso:

• [item 1 — com contexto e sugestão]
• [item 2]

[Se está tudo ok:]
Este caso está em dia. Não identifiquei pendências urgentes.

[Sempre finalize com:]
Posso ajudar com algum desses pontos?"

IMPORTANTE: Seja conciso na auditoria. Máximo 8-10 linhas. Não repita dados óbvios.

### ANÁLISE PROATIVA EM CONVERSAS

Ao responder sobre um caso (não na auditoria), se identificar pontos críticos durante a análise, INICIE a resposta com:

"Antes de continuar, identifiquei [X] pontos de atenção neste caso:

• [item]

Deseja que eu trate isso primeiro?"

### REVISÃO DE DOCUMENTOS GERADOS

Após gerar qualquer peça processual (petição, procuração, contrato), SEMPRE adicione ao final:

---

**Revisão da LARA:**

✓ [itens verificados e corretos — ex: Qualificação das partes completa]
✓ [ex: Fundamentação legal presente]

[Se houver pontos de atenção:]
⚠ [item que precisa de atenção — ex: Valor da causa não informado]

💡 Sugestão: [melhoria opcional — ex: Considerar incluir pedido de tutela de urgência]

---

Após o bloco de revisão, adicione:

"Quer que eu revise esta peça com olhar crítico mais aprofundado?"

### SUGESTÕES ESTRATÉGICAS

Quando a advogada descrever a situação do caso, identifique e sugira estratégias não óbvias:

- Medidas cautelares aplicáveis
- Cumulação de pedidos possível
- Teses defensivas do outro lado que devem ser antecipadas
- Jurisprudência favorável relevante
- Documentos que podem fortalecer a tese

Apresente como:

"Analisando este caso, identifico algumas estratégias que podem ser relevantes:

1. [estratégia com fundamentação]
2. [estratégia]"

### PONTOS CEGOS

Ao gerar petições, verifique ativamente:

- Competência territorial correta?
- Legitimidade ativa e passiva?
- Interesse de agir demonstrado?
- Possibilidade jurídica do pedido?
- Prazo prescricional/decadencial?

Se identificar risco: "Ponto de atenção: [descrição do risco e sugestão]"

## Comandos especiais
Quando a mensagem começar com um comando, SEMPRE use os dados do contexto para preencher automaticamente:
- /procuracao → Gere uma procuração ad judicia COMPLETA E PREENCHIDA com os dados do cliente e caso do contexto (nome, CPF, endereço, qualificação, poderes, dados da advogada). NÃO peça dados que já existem no contexto.
- /contrato → Gere um contrato de honorários COMPLETO E PREENCHIDO com dados do cliente e tipo de ação do contexto. Inclua cláusulas de valor, pagamento, obrigações e rescisão.
- /peticao → Redija a petição inicial COMPLETA com qualificação das partes preenchida com dados do contexto, fatos, direito e pedidos adequados ao tipo de ação.
- /checklist → Gere lista completa de documentos necessários para o tipo de caso
- /analise → Analise o documento ou informação fornecida e dê um parecer técnico
- /lei [número ou nome] → Busque a lei no LexML e retorne título, resumo e link oficial
- /intimacoes → Mostre um resumo formatado de todas as intimações pendentes com prazos

## Intimações
Quando o usuário perguntar sobre intimações, prazos urgentes, ou o que chegou em determinado processo, use os dados da seção "INTIMAÇÕES RECENTES" do contexto.

## Envio de WhatsApp — Cobrança de documentos pendentes
Quando a advogada pedir para cobrar documentos pendentes, enviar lembretes por WhatsApp, ou usar o comando /cobrar:

1. Identifique todos os clientes que possuem documentos pendentes (status "solicitado") e/ou itens de checklist pendentes (done = false) usando os dados do CONTEXTO ATUAL DO ESCRITÓRIO.
2. Para CADA cliente com pendências, gere uma mensagem personalizada usando o TEMPLATE DE COBRANÇA fornecido na seção CONFIGURAÇÕES DO ESCRITÓRIO abaixo.
   - No template, substitua as variáveis: {nome} pelo primeiro nome do cliente, {documentos} pela lista de documentos pendentes formatada com bullets.
   - Se não houver template customizado configurado, use o template padrão:
     "Olá {nome}! Tudo bem?\n\nSou a Dra. Daiane Rosendo. Passando para lembrar que ainda precisamos dos seguintes documentos para dar andamento ao seu processo:\n\n{documentos}\n\nAssim que puder, envie pelo portal ou responda esta mensagem. Qualquer dúvida estou à disposição!"

3. Após listar TODAS as mensagens, adicione o seguinte bloco de ação no final da sua resposta (OBRIGATÓRIO — este bloco é processado pelo sistema para habilitar o botão de envio):

\`\`\`whatsapp-action
[
  {"phone": "[telefone do cliente 1]", "message": "[mensagem completa com template aplicado]", "name": "[nome do cliente 1]"},
  {"phone": "[telefone do cliente 2]", "message": "[mensagem completa com template aplicado]", "name": "[nome do cliente 2]"}
]
\`\`\`

4. Antes do bloco de ação, escreva: "Deseja enviar para X clientes? Clique no botão abaixo para confirmar o envio."

REGRAS IMPORTANTES para WhatsApp:
- Só inclua clientes que tenham telefone cadastrado. Se um cliente não tem telefone, mencione isso e pule.
- Use os dados REAIS do contexto. Nunca invente nomes, telefones ou documentos.
- Formate o telefone apenas com números (ex: 5511999999999).
- Se não houver clientes com pendências, informe que está tudo em dia.
- Se a advogada pedir para cobrar um cliente específico, gere apenas a mensagem daquele cliente.
- SEMPRE use o template configurado nas CONFIGURAÇÕES DO ESCRITÓRIO. Se o template estiver vazio ou não existir, use o template padrão acima.`;

async function fetchSkills(supabase: any, userId?: string): Promise<string> {
  const query = supabase
    .from("lara_skills")
    .select("name, trigger_keywords, system_instructions, actions_available")
    .eq("is_active", true);

  // Get builtin + user's custom skills
  if (userId) {
    query.or(`is_builtin.eq.true,user_id.eq.${userId}`);
  } else {
    query.eq("is_builtin", true);
  }

  const { data } = await query;
  if (!data || data.length === 0) return "";

  let ctx = "\n\n## SUAS HABILIDADES ATIVAS\n";
  for (const skill of data) {
    ctx += `\n### ${skill.name}\n`;
    ctx += `Gatilhos: ${(skill.trigger_keywords || []).join(", ")}\n`;
    ctx += `Instruções: ${skill.system_instructions}\n`;
    ctx += `Ações disponíveis: ${(skill.actions_available || []).join(", ")}\n`;
  }
  return ctx;
}

async function fetchSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "template_doc_reminder",
      "template_welcome",
      "template_signing",
      "office_name",
      "office_oab",
      "office_phone",
      "office_email",
    ]);
  const map: Record<string, string> = {};
  for (const row of data || []) map[row.key] = row.value;
  return map;
}

async function fetchOfficeContext(supabase: any, hasCaseId: boolean): Promise<string> {
  // 1. All clients (not just active) with address fields
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, cpf, email, phone, status, address_street, address_number, address_city, address_state, address_zip, rg, nationality, marital_status, profession");

  if (!clients || clients.length === 0) {
    return `\n=== DADOS REAIS DO ESCRITÓRIO ===\nNenhum cliente encontrado no sistema.\n=== FIM DOS DADOS ===`;
  }

  // 2. ALL cases with ALL documents, checklist, hearings via join
  const { data: cases } = await supabase
    .from("cases")
    .select("id, case_type, status, client_id, cnj_number, court, description, children, opposing_party_name, opposing_party_cpf, opposing_party_address, created_at");

  const caseIds = (cases || []).map((c: any) => c.id);

  // 3. Fetch ALL documents, ALL checklist items, ALL hearings (not filtered by status)
  const [docsResult, checklistResult, hearingsResult] = await Promise.all([
    caseIds.length > 0
      ? supabase.from("documents").select("id, name, category, status, case_id, created_at").in("case_id", caseIds)
      : { data: [] },
    caseIds.length > 0
      ? supabase.from("checklist_items").select("id, label, done, case_id, required_by").in("case_id", caseIds)
      : { data: [] },
    caseIds.length > 0
      ? supabase.from("hearings").select("id, title, date, status, location, case_id").in("case_id", caseIds).order("date", { ascending: true })
      : { data: [] },
  ]);

  const allDocs = docsResult.data || [];
  const allChecklist = checklistResult.data || [];
  const allHearings = hearingsResult.data || [];

  // Group by case
  const docsByCase: Record<string, any[]> = {};
  for (const d of allDocs) { if (!docsByCase[d.case_id]) docsByCase[d.case_id] = []; docsByCase[d.case_id].push(d); }
  const checklistByCase: Record<string, any[]> = {};
  for (const c of allChecklist) { if (!checklistByCase[c.case_id]) checklistByCase[c.case_id] = []; checklistByCase[c.case_id].push(c); }
  const hearingsByCase: Record<string, any[]> = {};
  for (const h of allHearings) { if (!hearingsByCase[h.case_id]) hearingsByCase[h.case_id] = []; hearingsByCase[h.case_id].push(h); }

  const casesByClient: Record<string, any[]> = {};
  for (const c of cases || []) { if (!casesByClient[c.client_id]) casesByClient[c.client_id] = []; casesByClient[c.client_id].push(c); }

  const clientsById: Record<string, any> = {};
  for (const cl of clients) clientsById[cl.id] = cl;

  // Build comprehensive context
  let ctx = "\n=== DADOS REAIS DO ESCRITÓRIO ===\n\nCASOS ATIVOS:\n";
  let caseNum = 0;

  for (const client of clients) {
    const clientCases = casesByClient[client.id] || [];
    if (clientCases.length === 0) continue;

    for (const cs of clientCases) {
      caseNum++;
      const docs = docsByCase[cs.id] || [];
      const checklist = checklistByCase[cs.id] || [];
      const hearings = hearingsByCase[cs.id] || [];

      // Check missing client data
      const missingFields: string[] = [];
      if (!client.phone) missingFields.push("telefone");
      if (!client.address_street) missingFields.push("endereço");
      if (!client.cpf) missingFields.push("CPF");
      if (!client.rg) missingFields.push("RG");
      if (!client.marital_status) missingFields.push("estado civil");
      if (!client.profession) missingFields.push("profissão");
      const children = cs.children || [];
      if (!Array.isArray(children) || children.length === 0) missingFields.push("filhos");
      if (!cs.opposing_party_name) missingFields.push("dados da parte contrária");

      const address = client.address_street
        ? `${client.address_street}, ${client.address_number || "S/N"} — ${client.address_city || ""}/${client.address_state || ""} CEP ${client.address_zip || ""}`
        : "Não cadastrado";

      ctx += `\nCaso ${caseNum}:`;
      ctx += `\n- Cliente: ${client.name} (ID: ${client.id}) | Telefone: ${client.phone || "N/A"} | E-mail: ${client.email || "N/A"} | CPF: ${client.cpf || "N/A"}`;
      ctx += `\n- Endereço: ${address}`;
      ctx += `\n- Tipo: ${cs.case_type} | Status: ${cs.status} | CNJ: ${cs.cnj_number || "N/A"}`;
      ctx += `\n- Aberto em: ${cs.created_at}`;
      ctx += `\n- Parte contrária: ${cs.opposing_party_name || "Não cadastrada"}${cs.opposing_party_cpf ? ` (CPF: ${cs.opposing_party_cpf})` : ""}`;
      ctx += `\n- Filhos: ${Array.isArray(children) && children.length > 0 ? children.map((c: any) => `${c.name} (${c.birth_date || c.birthdate || "N/I"})`).join(", ") : "Nenhum cadastrado"}`;
      ctx += `\n- Documentos no sistema (${docs.length}): ${docs.length > 0 ? docs.map((d: any) => `${d.name} [${d.category}] (${d.status})`).join(", ") : "Nenhum"}`;
      ctx += `\n- Checklist (${checklist.length}): ${checklist.length > 0 ? checklist.map((c: any) => `${c.label} (${c.done ? "concluído" : "PENDENTE"})`).join(", ") : "Nenhum"}`;
      ctx += `\n- Audiências (${hearings.length}): ${hearings.length > 0 ? hearings.map((h: any) => `${h.title} em ${h.date} (${h.status})`).join(", ") : "Nenhuma"}`;
      ctx += `\n- Dados faltantes no cadastro: ${missingFields.length > 0 ? missingFields.join(", ") : "Nenhum — cadastro completo"}`;
      ctx += "\n";
    }
  }

  // Summary stats
  const statusCounts: Record<string, number> = {};
  for (const c of cases || []) { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; }
  const pendingDocs = allDocs.filter((d: any) => d.status === "solicitado");
  const pendingChecklist = allChecklist.filter((c: any) => !c.done);

  ctx += `\nRESUMO: ${clients.length} clientes, ${(cases || []).length} casos, ${pendingDocs.length} documentos pendentes (solicitados), ${pendingChecklist.length} itens de checklist pendentes.`;
  ctx += `\nCasos por status: ${Object.entries(statusCounts).map(([s, n]) => `${s}: ${n}`).join(", ") || "N/A"}`;
  ctx += "\n=== FIM DOS DADOS ===";

  return ctx;
}

async function fetchIntimacoesContext(supabase: any): Promise<string> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: intimacoes } = await supabase
    .from("intimacoes")
    .select("process_number, tribunal, movement_type, deadline_date, status, ai_summary, created_at, cases(case_type, clients(name))")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  if (!intimacoes || intimacoes.length === 0) {
    return "\n\n## INTIMAÇÕES RECENTES (últimos 30 dias)\nNenhuma intimação recebida nos últimos 30 dias.";
  }

  let ctx = "\n\n## INTIMAÇÕES RECENTES (últimos 30 dias)\n";
  for (const i of intimacoes) {
    const caseName = i.cases ? `${i.cases.case_type} — ${i.cases.clients?.name}` : "Não vinculado";
    ctx += `- Processo: ${i.process_number || "N/I"} | Tribunal: ${i.tribunal || "N/I"} | Tipo: ${i.movement_type || "N/I"} | Prazo: ${i.deadline_date || "sem prazo"} | Status: ${i.status} | Caso: ${caseName}\n`;
    if (i.ai_summary) ctx += `  Resumo: ${i.ai_summary}\n`;
  }
  return ctx;
}

async function fetchCaseContext(supabase: any, caseId: string): Promise<string> {
  const { data: caseData } = await supabase
    .from("cases")
    .select("*, clients(name, cpf, email, phone, status, rg, nationality, marital_status, profession, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip)")
    .eq("id", caseId)
    .single();

  if (!caseData) return "";

  const client = (caseData as any).clients;

  const [docsResult, checklistResult, hearingsResult] = await Promise.all([
    supabase
      .from("documents")
      .select("name, category, status, uploaded_by, created_at")
      .eq("case_id", caseId),
    supabase
      .from("checklist_items")
      .select("label, done, required_by")
      .eq("case_id", caseId),
    supabase
      .from("hearings")
      .select("title, date, location, status, notes")
      .eq("case_id", caseId)
      .order("date", { ascending: true }),
  ]);

  const docs = docsResult.data || [];
  const checklist = checklistResult.data || [];
  const hearings = hearingsResult.data || [];

  // Format address
  let addressStr = "[PREENCHER: endereço completo]";
  if (client?.address_street) {
    addressStr = `${client.address_street}, ${client.address_number || "S/N"}`;
    if (client.address_complement) addressStr += `, ${client.address_complement}`;
    addressStr += ` — ${client.address_neighborhood || ""}, ${client.address_city || ""}/${client.address_state || ""} — CEP ${client.address_zip || ""}`;
  }

  // Format children
  const children = caseData.children || [];
  let childrenStr = "Nenhum filho/menor cadastrado.";
  if (Array.isArray(children) && children.length > 0) {
    childrenStr = children.map((c: any) =>
      `- ${c.name}, nascido em ${c.birth_date || "N/I"}${c.cpf ? `, CPF ${c.cpf}` : ""}`
    ).join("\n");
  }

  // Format opposing party
  let opposingStr = "Não cadastrada.";
  if (caseData.opposing_party_name) {
    opposingStr = `${caseData.opposing_party_name}`;
    if (caseData.opposing_party_cpf) opposingStr += `, CPF ${caseData.opposing_party_cpf}`;
    if (caseData.opposing_party_address) opposingStr += `, residente em ${caseData.opposing_party_address}`;
  }

  return `
## Contexto do caso selecionado (DADOS REAIS DO BANCO — USE PARA PREENCHER DOCUMENTOS AUTOMATICAMENTE)
- **Nome completo do cliente**: ${client?.name || "[PREENCHER: nome completo]"}
- **CPF**: ${client?.cpf || "[PREENCHER: CPF]"}
- **RG**: ${client?.rg || "[PREENCHER: RG]"}
- **Nacionalidade**: ${client?.nationality || "[PREENCHER: nacionalidade]"}
- **Estado civil**: ${client?.marital_status || "[PREENCHER: estado civil]"}
- **Profissão**: ${client?.profession || "[PREENCHER: profissão]"}
- **E-mail**: ${client?.email || "[PREENCHER: e-mail]"}
- **Telefone**: ${client?.phone || "[PREENCHER: telefone]"}
- **Endereço**: ${addressStr}
- **Status do cliente**: ${client?.status || "N/A"}
- **Tipo de ação**: ${caseData.case_type}
- **Status do caso**: ${caseData.status}
- **Número do processo (CNJ)**: ${caseData.cnj_number || "[PREENCHER: número CNJ]"}
- **Vara/Comarca**: ${caseData.court || "[PREENCHER: vara e comarca]"}
- **Descrição do caso**: ${caseData.description || "Sem descrição"}

### Parte contrária
${opposingStr}

### Filhos/Menores
${childrenStr}

### Todos os documentos do caso (${docs.length})
${docs.length > 0
    ? docs.map((d: any) => `- ${d.name} [${d.category}] — Status: ${d.status} (enviado por: ${d.uploaded_by})`).join("\n")
    : "Nenhum documento cadastrado."}

### Checklist completo (${checklist.length} itens)
${checklist.length > 0
    ? checklist.map((c: any) => `- [${c.done ? "x" : " "}] ${c.label}${c.required_by ? ` (responsável: ${c.required_by})` : ""}`).join("\n")
    : "Nenhum item no checklist."}

### Audiências (${hearings.length})
${hearings.length > 0
    ? hearings.map((h: any) => `- ${h.title} — ${h.date} | Local: ${h.location || "N/I"} | Status: ${h.status}${h.notes ? ` | Obs: ${h.notes}` : ""}`).join("\n")
    : "Nenhuma audiência agendada."}`;
}

// Detect if user message needs LexML grounding
function detectLegalQuery(content: string): string | null {
  const lower = content.toLowerCase();
  // /lei command — always prefix with "lei" for better search results
  const leiMatch = lower.match(/^\/lei\s+(.+)/);
  if (leiMatch) {
    const term = leiMatch[1].trim();
    // If user typed just a number, prefix with "lei" for better LexML results
    if (/^\d[\d.\/\-]*$/.test(term)) return `lei ${term}`;
    return term;
  }
  // Mentions specific law numbers
  const lawPatterns = [
    /lei\s+(?:n[ºo°]?\s*)?(\d[\d.\/]+)/i,
    /código\s+civil/i,
    /código\s+penal/i,
    /constituição/i,
    /cpc/i,
    /eca/i,
    /art(?:igo)?\.?\s*\d+/i,
  ];
  for (const p of lawPatterns) {
    if (p.test(content)) {
      const m = content.match(/lei\s+(?:n[ºo°]?\s*)?(\d[\d.\/]+)/i);
      if (m) return `lei ${m[1]}`;
      if (/código\s+civil/i.test(content)) return "código civil lei 10406";
      if (/código\s+penal/i.test(content)) return "código penal";
      if (/constituição/i.test(content)) return "constituição federal";
      if (/\bcpc\b/i.test(content)) return "código de processo civil lei 13105";
      if (/\beca\b/i.test(content)) return "estatuto da criança e do adolescente lei 8069";
      return content.slice(0, 80);
    }
  }
  return null;
}

async function fetchLexMLContext(query: string, supabaseUrl: string): Promise<string> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/lexml-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    if (!data.results || data.results.length === 0) return "";

    let ctx = "\n\n## FUNDAMENTAÇÃO LEXML (fonte oficial — cite as URNs na resposta)\n";
    ctx += `Pesquisa realizada em: ${data.timestamp}\n\n`;
    for (const r of data.results) {
      ctx += `- **${r.title}**\n`;
      if (r.urn) ctx += `  URN: ${r.urn}\n`;
      if (r.date) ctx += `  Data: ${r.date}\n`;
      if (r.summary) ctx += `  Resumo: ${r.summary}\n`;
      if (r.url) ctx += `  Link: ${r.url}\n`;
      ctx += "\n";
    }
    return ctx;
  } catch (e) {
    console.error("LexML context fetch error:", e);
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, caseId, attachments } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Detect if this is a case audit request
    const lastMsg = messages[messages.length - 1];
    const isCaseAudit = lastMsg?.role === "user" && lastMsg.content.trim() === "__CASE_AUDIT__";

    // Detect if last user message needs LexML grounding
    const legalQuery = (!isCaseAudit && lastMsg?.role === "user") ? detectLegalQuery(lastMsg.content) : null;
    
    // Check if this is a direct /lei command
    const isLeiCommand = !isCaseAudit && lastMsg?.role === "user" && /^\/lei\s+/i.test(lastMsg.content.trim());

    // Fetch all context in parallel (including LexML if needed)
    const [officeContext, caseContext, settings, lexmlContext, intimacoesContext, skillsContext] = await Promise.all([
      fetchOfficeContext(supabase, !!caseId),
      caseId ? fetchCaseContext(supabase, caseId) : Promise.resolve(""),
      fetchSettings(supabase),
      legalQuery ? fetchLexMLContext(legalQuery, supabaseUrl) : Promise.resolve(""),
      fetchIntimacoesContext(supabase),
      fetchSkills(supabase),
    ]);
    
    // If /lei command but LexML returned nothing, return error immediately
    if (isLeiCommand && !lexmlContext) {
      const lawNum = lastMsg.content.trim().replace(/^\/lei\s+/i, "");
      const errorMsg = `Não encontrei a lei ${lawNum} no LexML. Verifique o número e tente novamente com /lei [número completo]`;
      // Return as a streaming response for consistency
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errorMsg } }] })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }
    
    // For /lei commands, rewrite the user message to instruct AI to use LexML data
    if (isLeiCommand && lexmlContext) {
      const lawNum = lastMsg.content.trim().replace(/^\/lei\s+/i, "");
      messages[messages.length - 1] = {
        ...lastMsg,
        content: `Consulta detalhada de legislação para a lei ${lawNum}. Use os dados reais do LexML fornecidos no contexto. Responda de forma DETALHADA e ESTRUTURADA incluindo:

1. **Título e identificação completa** (número, data, ementa oficial)
2. **Contexto e finalidade** — por que esta lei foi criada, qual problema resolve
3. **Principais artigos e dispositivos aplicáveis** — cite os artigos mais relevantes com explicação
4. **Direitos e deveres** estabelecidos pela norma
5. **Prazos e procedimentos** previstos
6. **Exceções e casos especiais**
7. **Consequências práticas** para o Direito de Família
8. **Exemplo prático** de aplicação

Ao final, inclua:
- **URN oficial**: a URN do LexML
- **Link para texto completo**: o link do LexML

Use seu conhecimento jurídico para complementar os dados do LexML com explicações detalhadas. Cite artigos específicos sempre que possível. NÃO faça resumo genérico — seja detalhado e prático.`,
      };
    }

    // Build settings context string
    let settingsContext = "\n\n## CONFIGURAÇÕES DO ESCRITÓRIO\n";
    if (settings.office_name) settingsContext += `- Nome do escritório: ${settings.office_name}\n`;
    if (settings.office_oab) settingsContext += `- OAB: ${settings.office_oab}\n`;
    if (settings.office_phone) settingsContext += `- Telefone do escritório: ${settings.office_phone}\n`;
    if (settings.office_email) settingsContext += `- E-mail do escritório: ${settings.office_email}\n`;
    if (settings.template_doc_reminder) {
      settingsContext += `\n### TEMPLATE DE COBRANÇA DE DOCUMENTOS (usar ao cobrar via WhatsApp):\n${settings.template_doc_reminder}\n`;
    }
    if (settings.template_welcome) {
      settingsContext += `\n### TEMPLATE DE BOAS-VINDAS:\n${settings.template_welcome}\n`;
    }
    if (settings.template_signing) {
      settingsContext += `\n### TEMPLATE DE ASSINATURA:\n${settings.template_signing}\n`;
    }

    const fullSystemPrompt = officeContext + "\n\n" + SYSTEM_PROMPT + "\n\n" + settingsContext + intimacoesContext + skillsContext + (caseContext ? "\n\n" + caseContext : "") + lexmlContext;

    // Build messages for the AI API
    const aiMessages: any[] = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Process messages, handling attachments
    for (const msg of messages) {
      if (msg.role === "user" && msg.attachments && msg.attachments.length > 0) {
        const content: any[] = [{ type: "text", text: msg.content }];
        for (const att of msg.attachments) {
          if (att.type === "image") {
            content.push({
              type: "image_url",
              image_url: { url: att.data },
            });
          } else if (att.type === "pdf") {
            content.push({
              type: "text",
              text: `[Documento anexado: ${att.name}]\n${att.extractedText || "(conteúdo não extraído)"}`,
            });
          }
        }
        aiMessages.push({ role: "user", content });
      } else {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Save the user message to DB (skip audit messages)
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === "user" && caseId && !isCaseAudit) {
      await supabase.from("messages").insert({
        case_id: caseId,
        role: "user",
        content: lastUserMsg.content,
        attachments: lastUserMsg.attachments || null,
      });
    }

    // Determine max_tokens based on document commands
    const lastContent = lastMsg?.content?.toLowerCase() || "";
    const isDocumentCommand = lastContent.includes("/peticao") || lastContent.includes("/procuracao") || lastContent.includes("/contrato");
    const maxTokens = isDocumentCommand ? 8192 : 4096;

    // Call Lovable AI Gateway with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com a IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Intercept the stream to save the full assistant response to DB
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullAssistantContent = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          if (caseId && fullAssistantContent && !isCaseAudit) {
            await supabase.from("messages").insert({
              case_id: caseId,
              role: "assistant",
              content: fullAssistantContent,
            });
          }
          controller.close();
          return;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullAssistantContent += content;
          } catch {
            // partial chunk, ignore
          }
        }

        controller.enqueue(value);
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("lara-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
