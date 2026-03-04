import { askGemini } from './gemini';
import prisma from '../config/database';
import { getBrandContext } from './brand-brain.agent';

export interface DailyStrategy {
  postsToCreate: number;
  topics: string[];
  scheduledTimes: string[];
  focusType: string[];
  reasoning: string;
}

// Distribuição ideal: 40% educativo, 30% engajamento, 20% autoridade, 10% bastidores
const CONTENT_MIX_WEIGHTS = [
  { type: 'educativo', weight: 40 },
  { type: 'engajamento', weight: 30 },
  { type: 'autoridade', weight: 20 },
  { type: 'bastidores', weight: 10 },
];

function pickFocusTypes(count: number): string[] {
  const types: string[] = [];
  const pool = CONTENT_MIX_WEIGHTS.flatMap((w) =>
    Array(Math.ceil(w.weight / 10)).fill(w.type)
  );
  for (let i = 0; i < count; i++) {
    // Rotate through weighted pool ensuring variety
    const available = pool.filter((t) => !types.includes(t) || types.length >= pool.length);
    types.push(available[i % available.length]);
  }
  return types;
}

export async function buildDailyStrategy(): Promise<DailyStrategy> {
  const lastReport = await prisma.metricsReport.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const recentPosts = await prisma.scheduledPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: { topic: true, message: true, contentType: true },
  });

  const trendingCache = await prisma.trendingCache.findFirst({
    where: { expiresAt: { gte: new Date() } },
    orderBy: { generatedAt: 'desc' },
  });

  const trendingContext = trendingCache
    ? `Tendências em alta esta semana: ${(trendingCache.trends as any[]).map((t: any) => t.topic).join(', ')}. Use como inspiração para temas relevantes e virais.`
    : '';

  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  const recentTopics = recentPosts.map((p) => p.topic).filter(Boolean).join(', ');
  const metricsContext = lastReport
    ? `Último relatório de métricas (score ${lastReport.growthScore}/10):
- Resumo: ${lastReport.summary}
- Melhores horários: ${lastReport.bestPostingTimes}
- Recomendações: ${lastReport.recommendations}`
    : 'Nenhum relatório de métricas disponível ainda. Use estratégia agressiva de crescimento.';

  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('pt-BR');

  const prompt = `
Você é um estrategista de conteúdo focado em CRESCIMENTO ACELERADO de página no Facebook.

OBJETIVO: Crescer seguidores, alcance e engajamento de forma orgânica e consistente.

${brandCtx}

REGRAS ABSOLUTAS:
- NÃO sugerir temas sobre filmes, séries, streaming, TV online ou entretenimento genérico.
- Focar em: dicas práticas, tendências, conhecimento útil, provocações inteligentes, insights poderosos.
- Cada post deve ter potencial VIRAL — algo que as pessoas queiram compartilhar.
- Cada post DEVE se encaixar em um dos 4 PILARES TEMÁTICOS definidos nas brand guidelines.
- ROTAÇÃO OBRIGATÓRIA: cada post do dia deve cobrir um pilar DIFERENTE. NÃO repetir pilar no mesmo dia.

Hoje é ${dayOfWeek}, ${dateStr}.

${metricsContext}

TEMAS JÁ PUBLICADOS RECENTEMENTE (últimos 50 posts — é PROIBIDO repetir qualquer um destes temas ou variações semelhantes):
${recentTopics || 'nenhum ainda'}

${trendingContext}

DISTRIBUIÇÃO DE CONTEÚDO (seguir rigorosamente):
- 40% educativo (dicas, tutoriais, checklists, "como fazer")
- 30% engajamento (perguntas, debates, enquetes, opiniões)
- 20% autoridade (dados, análises, tendências, estudos de caso)
- 10% bastidores (humanização, processo, aprendizados, histórias)

Com base nesses dados, crie a estratégia de conteúdo para HOJE.

Retorne APENAS um JSON válido neste formato exato:
{
  "postsToCreate": 3,
  "topics": ["tema viral 1", "tema viral 2", "tema viral 3"],
  "scheduledTimes": ["09:00", "14:00", "19:00"],
  "focusType": ["educativo", "engajamento", "autoridade"],
  "pilpilar": ["Liderança & Estratégia", "Tecnologia & Inovação", "Performance & Resultados"],
  "reasoning": "Justificativa breve da estratégia"
}

Regras:
- postsToCreate: entre 2 e 4 (se engajamento baixo, criar mais; se alto, manter qualidade)
- topics: temas COMPLETAMENTE DIFERENTES dos 50 recentes listados acima. NÃO repita tema, ângulo, ou variação semelhante. PROIBIDO temas de entretenimento/filmes/séries.
- scheduledTimes: horários entre 08:00 e 22:00, com pelo menos 2h de intervalo
- focusType: "educativo" | "engajamento" | "autoridade" | "bastidores"
- pilar: qual dos 4 pilares temáticos cada post aborda (cada post deve ter pilar diferente)
- reasoning: 1-2 frases explicando a escolha estratégica
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta inválida do Gemini ao criar estratégia');

  const strategy: DailyStrategy = JSON.parse(jsonMatch[0]);

  // Validação
  strategy.postsToCreate = Math.max(2, Math.min(4, strategy.postsToCreate));
  strategy.topics = strategy.topics.slice(0, strategy.postsToCreate);
  strategy.scheduledTimes = strategy.scheduledTimes.slice(0, strategy.postsToCreate);

  // Garantir distribuição correta se LLM ignorar
  if (!strategy.focusType || strategy.focusType.length < strategy.postsToCreate) {
    strategy.focusType = pickFocusTypes(strategy.postsToCreate);
  } else {
    strategy.focusType = strategy.focusType.slice(0, strategy.postsToCreate);
  }

  return strategy;
}
