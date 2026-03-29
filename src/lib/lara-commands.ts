const COMMAND_EXPANSIONS: Record<string, string> = {
  "/procuracao":
    "/procuracao — Por favor, gere um modelo completo de procuração ad judicia para o caso em questão, com todos os poderes necessários para a ação de família correspondente.",
  "/contrato":
    "/contrato — Por favor, gere um modelo de contrato de honorários advocatícios para o caso em questão, incluindo cláusulas sobre valor, forma de pagamento, obrigações e rescisão.",
  "/peticao":
    "/peticao — Por favor, inicie a redação de uma petição inicial adequada ao tipo de caso, com qualificação das partes, dos fatos, do direito e dos pedidos. Use os dados do caso.",
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
