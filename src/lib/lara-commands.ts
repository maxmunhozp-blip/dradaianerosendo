const COMMAND_EXPANSIONS: Record<string, string> = {
  "/procuracao":
    "/procuracao — Gere uma procuração ad judicia COMPLETA E PREENCHIDA com todos os dados do cliente e caso que estão disponíveis no contexto (nome completo, CPF, endereço, qualificação). Use os dados reais do banco de dados. NÃO me peça informações que já existem no sistema. Campos que não existirem no banco, marque com [PREENCHER: campo].",
  "/contrato":
    "/contrato — Gere um contrato de honorários advocatícios COMPLETO E PREENCHIDO com os dados do cliente e caso do contexto. Use os dados reais do banco de dados. NÃO me peça informações que já existem no sistema. Inclua cláusulas sobre valor, forma de pagamento, obrigações e rescisão.",
  "/peticao":
    "/peticao — Redija uma petição inicial COMPLETA com a qualificação das partes PREENCHIDA com os dados reais do cliente do contexto (nome, CPF, endereço, etc). Use os dados do banco de dados. NÃO me peça informações que já existem no sistema. Inclua fatos, direito e pedidos adequados ao tipo de ação.",
  "/checklist":
    "/checklist — Por favor, gere uma lista completa de todos os documentos necessários para este tipo de ação, indicando quais são obrigatórios e quais são recomendados.",
  "/analise":
    "/analise — Por favor, analise as informações e documentos disponíveis sobre este caso e forneça um parecer técnico com pontos fortes, riscos e recomendações estratégicas.",
  "/cobrar":
    "/cobrar — Por favor, identifique todos os clientes com documentos pendentes e gere mensagens personalizadas de WhatsApp para cobrança. Inclua o bloco whatsapp-action com os dados para envio.",
  "/agenda":
    "/agenda — Por favor, liste todas as audiências e prazos futuros, agrupados por semana, indicando caso, cliente, data, hora e local. Destaque os que estão próximos (48h) ou atrasados.",
  "/jurisprudencia":
    "/jurisprudencia — Por favor, pesquise e apresente jurisprudências relevantes e recentes dos tribunais superiores (STF, STJ) e tribunais estaduais sobre o tema deste caso. Inclua número do processo, relator, data, ementa resumida e tese firmada. Organize por tribunal e relevância.",
  "/resumo":
    "/resumo — Por favor, gere um resumo executivo completo deste caso, incluindo: partes envolvidas, tipo de ação, status atual, documentos já reunidos, documentos pendentes, próximas audiências, pontos fortes e fracos, e recomendações de próximos passos.",
  "/prazos":
    "/prazos — Por favor, calcule e liste todos os prazos processuais aplicáveis a este tipo de ação, considerando o status atual do caso. Indique prazos já vencidos, em andamento e futuros, com datas estimadas e fundamentação legal.",
  "/modelo":
    "/modelo — Por favor, gere um modelo de documento jurídico adequado para a fase atual deste caso (contestação, recurso, manifestação, etc.), preenchido com os dados disponíveis do caso e do cliente.",
  "/mail":
    "/mail — Por favor, mostre um resumo dos e-mails não lidos por conta de e-mail conectada, indicando quantos são não lidos e quantos são judiciais (de domínios *.jus.br). Formato:\n\nE-mails não lidos por conta:\n- [nome da conta]: X não lidos (Y judiciais)\n- [nome da conta]: X não lidos (Y judiciais)",
};

/**
 * Expands a command into display text (what user sees) and API text (what gets sent to the AI).
 * For /lei, the original text is preserved in display while the API gets an instruction.
 * For other commands, expansion happens normally.
 */
export function expandCommand(input: string): { display: string; api: string } {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Special handling for /lei — keep original in display, send instruction to API
  const leiMatch = lower.match(/^\/lei\s+(.+)/);
  if (leiMatch) {
    return {
      display: trimmed,
      api: trimmed, // Pass the raw /lei command so the edge function can detect it
    };
  }

  // Other commands — expand for both display and API
  for (const [cmd, expansion] of Object.entries(COMMAND_EXPANSIONS)) {
    if (lower === cmd || lower.startsWith(cmd + " ")) {
      const extra = trimmed.slice(cmd.length).trim();
      const expanded = extra ? `${expansion}\n\nInformações adicionais: ${extra}` : expansion;
      return { display: expanded, api: expanded };
    }
  }

  return { display: input, api: input };
}

export const COMMANDS = [...Object.keys(COMMAND_EXPANSIONS), "/lei"];
