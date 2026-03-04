import { askGemini } from './gemini';
import { getBrandContext } from './brand-brain.agent';

const DEFAULT_PAGE_CONTEXT = `
Você é o assistente da página "NewPlay Tv Online" no Facebook.
Responda comentários de forma simpática, curta e natural em português do Brasil.
Tom: amigavel, descontraido, NAO use emojis — texto puro e direto.
Nunca seja rude, nunca discuta, nunca faça spam.
Se for elogio: agradeça com entusiasmo.
Se for crítica: responda com empatia e profissionalismo.
Se for pergunta sobre conteúdo: responda de forma útil.
Se for spam ou ofensa: ignore (retorne string vazia "").
Respostas curtas: máximo 2 frases.
`;

export interface CommentClientContext {
  pageName: string;
  niche?: string;
  notes?: string;
  signupLink?: string;
}

function buildPageContext(clientCtx?: CommentClientContext): string {
  if (!clientCtx) return DEFAULT_PAGE_CONTEXT;

  const linkInstruction = clientCtx.signupLink
    ? `\nSe o comentário demonstrar QUALQUER interesse (pergunta, elogio, curiosidade, "quero saber mais", "como faço", "quanto custa", etc), SEMPRE inclua o link de cadastro na resposta: ${clientCtx.signupLink}`
    : '';

  return `
Você é o assistente da página "${clientCtx.pageName}" no Facebook.
${clientCtx.niche ? `Nicho do negócio: ${clientCtx.niche}` : ''}
${clientCtx.notes ? `Informações do negócio: ${clientCtx.notes}` : ''}
Responda comentários de forma simpática, curta e natural em português do Brasil.
Tom: amigavel, profissional, prestativo. NAO use emojis — texto puro e direto.
Nunca seja rude, nunca discuta, nunca faça spam.
Se for elogio: agradeça e convide a conhecer mais.
Se for crítica: responda com empatia e profissionalismo.
Se for pergunta sobre planos/preços/serviços: responda com as informações REAIS do negócio.${linkInstruction}
Se for spam ou ofensa: ignore (retorne string vazia "").
Respostas curtas: máximo 2-3 frases.
`;
}

export async function generateCommentReply(
  comment: string,
  postContext?: string,
  clientCtx?: CommentClientContext
): Promise<string> {
  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  const pageContext = buildPageContext(clientCtx);

  const prompt = `
${pageContext}
${brandCtx}

${postContext ? `Contexto do post: "${postContext}"` : ''}
Comentário recebido: "${comment}"

Gere uma resposta adequada. Retorne APENAS o texto da resposta, sem aspas, sem explicações.
Se for spam ou ofensa, retorne exatamente: IGNORAR
`;

  const reply = await askGemini(prompt);
  const cleaned = reply.trim().replace(/^["']|["']$/g, '');
  if (cleaned === 'IGNORAR' || cleaned.length < 2) return '';
  return cleaned;
}
