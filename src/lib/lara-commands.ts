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
  "/lei":
    "/lei — Por favor, busque no LexML (portal oficial de legislação brasileira) informações sobre a lei especificada. Retorne título, resumo, URN oficial e link para o texto completo.",
};

export function expandCommand(input: string): string {
  const trimmed = input.trim().toLowerCase();
  for (const [cmd, expansion] of Object.entries(COMMAND_EXPANSIONS)) {
    if (trimmed === cmd || trimmed.startsWith(cmd + " ")) {
      const extra = input.trim().slice(cmd.length).trim();
      return extra ? `${expansion}\n\nInformações adicionais: ${extra}` : expansion;
    }
  }
  return input;
}

export const COMMANDS = Object.keys(COMMAND_EXPANSIONS);
