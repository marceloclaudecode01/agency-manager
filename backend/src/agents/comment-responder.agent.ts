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

// Priority classification via regex (zero LLM)
export type CommentPriority = 'BUY_INTENT' | 'DOUBT' | 'COMMON' | 'CRITICISM';

const BUY_INTENT_PATTERNS = /quanto|pre[cç]o|valor|custa|link|onde|compro|comprar|quero|me manda|manda o link|como compro|como fa[cç]o|dispon[ií]vel|parcela|interessei|interessad[ao]|adorei|amei|preciso|cadastr/i;
const DOUBT_PATTERNS = /como|por ?que|quando|funciona|serve|tem|pode|posso|consigo|d[aá] ?pra|existe|qual|diferença|melhor/i;
const CRITICISM_PATTERNS = /hor[rí]vel|p[eé]ssimo|ruim|fraude|golpe|mentira|enganação|procon|reclamar|nunca mais|lixo|vergonha|absurdo|roubo/i;

export function classifyCommentPriority(text: string): { priority: CommentPriority; score: number } {
  const lower = text.toLowerCase();
  if (BUY_INTENT_PATTERNS.test(lower)) return { priority: 'BUY_INTENT', score: 1 };
  if (CRITICISM_PATTERNS.test(lower)) return { priority: 'CRITICISM', score: 4 };
  if (DOUBT_PATTERNS.test(lower)) return { priority: 'DOUBT', score: 2 };
  return { priority: 'COMMON', score: 3 };
}

// Sort comments by priority (BUY_INTENT first, CRITICISM last)
export function sortByPriority<T extends { message: string }>(comments: T[]): T[] {
  return [...comments].sort((a, b) => {
    const pa = classifyCommentPriority(a.message).score;
    const pb = classifyCommentPriority(b.message).score;
    return pa - pb;
  });
}

export async function generateCommentReply(
  comment: string,
  postContext?: string,
  clientCtx?: CommentClientContext
): Promise<string> {
  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  const pageContext = buildPageContext(clientCtx);

  // Priority-based prompt differentiation
  const { priority } = classifyCommentPriority(comment);
  let priorityInstruction = '';
  if (priority === 'BUY_INTENT') {
    priorityInstruction = 'PRIORIDADE MÁXIMA: Este comentário demonstra intenção de compra. Responda com urgência, dê informações objetivas e conduza ao próximo passo (link, cadastro, contato).';
  } else if (priority === 'DOUBT') {
    priorityInstruction = 'Este comentário é uma dúvida. Responda de forma clara, objetiva e prestativa. Resolva a dúvida e convide a saber mais.';
  } else if (priority === 'CRITICISM') {
    priorityInstruction = 'Este comentário é uma crítica. Responda com empatia e profissionalismo. NUNCA discuta ou seja defensivo. Ofereça ajuda concreta.';
  }

  const prompt = `
${pageContext}
${brandCtx}
${priorityInstruction}

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
