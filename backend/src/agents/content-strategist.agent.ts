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

export interface ClientContext {
  clientId: string;
  clientName: string;
  niche: string;
  facebookPageName?: string;
  notes?: string;
}

// Distribuição ideal: autoridade 40%, viral 30%, comunidade 20%, venda 10%
const CONTENT_MIX_WEIGHTS = [
  { type: 'autoridade', weight: 40 },
  { type: 'engajamento', weight: 30 },
  { type: 'educativo', weight: 20 },
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

export async function buildDailyStrategy(clientCtx?: ClientContext): Promise<DailyStrategy> {
  const lastReport = await prisma.metricsReport.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  // Filter recent posts by client if multi-page
  const recentWhere: any = { status: 'PUBLISHED' };
  if (clientCtx) {
    recentWhere.clientId = clientCtx.clientId;
  }

  const recentPosts = await prisma.scheduledPost.findMany({
    where: recentWhere,
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: { topic: true, message: true, contentType: true },
  });

  const trendingCache = await prisma.trendingCache.findFirst({
    where: { expiresAt: { gte: new Date() } },
    orderBy: { generatedAt: 'desc' },
  });

  // Prioritize trends with viralScore > 70
  let trendingContext = '';
  if (trendingCache) {
    const allTrends = trendingCache.trends as any[];
    const highViralTrends = allTrends.filter((t: any) => (t.viralScore || 0) > 70);
    const trendList = highViralTrends.length > 0 ? highViralTrends : allTrends;
    trendingContext = `Tendências em alta esta semana (priorizadas por potencial viral): ${trendList.map((t: any) => `${t.topic} (viral:${t.viralScore || '?'}, comercial:${t.commercialScore || '?'}, formato:${t.formatoRecomendado || '?'})`).join('; ')}. PRIORIZE as tendências com maior viralScore.`;
  }

  // Read growth insights from Growth Analyst (bestPostingHours, bestHookTypes, bestCTAs)
  let growthContext = '';
  try {
    const growthConfig = await prisma.systemConfig.findUnique({ where: { key: 'growth_insights' } });
    if (growthConfig?.value) {
      const gi = growthConfig.value as any;
      growthContext = `
INSIGHTS DO GROWTH ANALYST (ultimos 7 dias):
- Melhores horarios: ${(gi.bestPostingHours || []).join(', ')}
- Melhores tipos de hook: ${(gi.bestHookTypes || []).join(', ')}
- Melhores CTAs: ${(gi.bestCTAs || []).join(', ')}
- Tipo que mais performa: ${gi.bestPerformingType || 'N/A'}
USE esses insights para otimizar a estrategia de hoje.`;
    }
  } catch {}

  // Inject NotebookLM research insights + topic memory
  let researchCtx = '';
  try {
    const { getResearchForStrategy, getTopicRecommendations } = await import('../services/research-intelligence.service');
    const [research, topicMemory] = await Promise.all([
      getResearchForStrategy(),
      getTopicRecommendations(),
    ]);
    researchCtx = research + topicMemory;
    if (researchCtx) {
      console.log('[Strategist] NotebookLM research + topic memory injected');
    }
  } catch {}

  let brandCtx = '';
  try { brandCtx = await getBrandContext(); } catch {}

  // Build niche-specific context for multi-page clients
  const nicheContext = clientCtx ? `
CLIENTE: ${clientCtx.clientName}${clientCtx.facebookPageName ? ` (Página: ${clientCtx.facebookPageName})` : ''}
NICHO DO CLIENTE: ${clientCtx.niche}
${clientCtx.notes ? `INFORMAÇÕES REAIS DO NEGÓCIO (USE APENAS ESTAS — NUNCA INVENTE DADOS):
${clientCtx.notes}` : ''}
IMPORTANTE: Todo o conteúdo DEVE ser 100% focado no nicho "${clientCtx.niche}".
REGRA CRÍTICA: Use SOMENTE informações reais fornecidas acima (planos, preços, benefícios). NUNCA invente valores, planos ou benefícios que não existam.
Gere conteúdo como se você fosse o MELHOR estrategista de conteúdo do mundo para este negócio.
Use terminologia, dores, desejos e linguagem específica deste nicho.
O conteúdo deve posicionar esta página como AUTORIDADE ABSOLUTA.
` : '';

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
Voce e o VP de Estrategia de Conteudo de uma holding que gerencia marcas bilionarias (Nike, Apple, Nubank, Red Bull, Tesla).
Sua missao: cada dia de conteudo e uma CAMPANHA ESTRATEGICA — nao posts isolados, mas pecas interconectadas que constroem imperio de marca.

MENTALIDADE BILIONARIA DE CONTEUDO:
- Cada post e um ATIVO que gera retorno composto — nao e descartavel, e investimento
- DOMINAR O FEED e o objetivo — quando alguem abre o Facebook, seu conteudo deve ser o mais inteligente que essa pessoa ve hoje
- Qualidade > frequencia — 3 posts extraordinarios vencem 10 mediocres
- DIVERSIDADE RADICAL de temas — marcas bilionarias nunca sao previsiveis

${nicheContext}
${brandCtx}

REGRAS ABSOLUTAS:
- NAO sugerir temas sobre filmes, series, streaming, TV online ou entretenimento generico
- Focar em: insights contraintuitivos, tendencias de fronteira, provocacoes intelectuais, frameworks acionaveis, dados surpreendentes
- Cada post deve passar no teste: "Uma pessoa inteligente compartilharia isso para parecer mais inteligente?" — se sim, publica
- Cada post DEVE se encaixar em um dos 4 PILARES TEMATICOS definidos nas brand guidelines
- ROTACAO OBRIGATORIA: cada post do dia deve cobrir um pilar DIFERENTE. NAO repetir pilar no mesmo dia

Hoje e ${dayOfWeek}, ${dateStr}.

${metricsContext}

TEMAS JA PUBLICADOS RECENTEMENTE (ultimos 100 posts — ABSOLUTAMENTE PROIBIDO repetir qualquer um, incluindo variacoes, sinonimos ou angulos similares):
${recentTopics || 'nenhum ainda'}

REGRA ANTI-REPETICAO NUCLEAR: Se um tema recente menciona "produtividade", NAO crie nada sobre produtividade, eficiencia, gestao de tempo ou performance pessoal — mude de UNIVERSO. Cada tema deve ser de uma GALAXIA completamente diferente. Pense: se alguem lesse todos os posts em sequencia, NUNCA deveria sentir que ja viu algo parecido.

${trendingContext}
${growthContext}
${researchCtx}

DISTRIBUICAO DE CONTEUDO (framework das marcas bilionarias):
- 40% autoridade (dados exclusivos, analises nivel McKinsey, tendencias de fronteira, posicionamento como a voz mais inteligente do nicho)
- 30% engajamento/viral (teses provocativas, debates que dividem, perguntas impossíveis de ignorar, conteudo que OBRIGA compartilhamento)
- 20% educativo (frameworks aplicaveis, modelos mentais poderosos, tecnicas que 99% ignoram, "curso gratis em formato de post")
- 10% bastidores/conexao (vulnerabilidade estrategica, bastidores reais, historias com licoes nao-obvias)

CRITERIO DE QUALIDADE: Se um tema nao faria voce parar o scroll se visse no SEU feed, descarte e gere outro.

Com base nesses dados, crie a estrategia de conteudo para HOJE.

Retorne APENAS um JSON valido neste formato exato:
{
  "postsToCreate": 3,
  "topics": ["tema viral 1", "tema viral 2", "tema viral 3"],
  "scheduledTimes": ["09:00", "14:00", "19:00"],
  "focusType": ["educativo", "engajamento", "autoridade"],
  "pilar": ["Lideranca & Estrategia", "Tecnologia & Inovacao", "Performance & Resultados"],
  "reasoning": "Justificativa breve da estrategia"
}

Regras:
- postsToCreate: entre 2 e 4 (qualidade acima de tudo — so crie 4 se todos forem 9+/10 em potencial)
- topics: temas de UNIVERSOS COMPLETAMENTE DIFERENTES dos 100 recentes. Cada tema deve ser um ASSUNTO INEDITO. PROIBIDO entretenimento/filmes/series. VARIE radicalmente entre: tecnologia de fronteira, psicologia comportamental, economia global, neurociencia aplicada, comunicacao estrategica, lideranca nao-convencional, criatividade e inovacao, ciencia surpreendente, tendencias emergentes, inteligencia artificial, marketing de elite, financas pessoais, cultura e sociedade, filosofia pratica, design thinking, biohacking — NUNCA 2 temas da mesma area no mesmo dia.
- scheduledTimes: horarios entre 08:00 e 22:00, com pelo menos 2h de intervalo
- focusType: "educativo" | "engajamento" | "autoridade" | "bastidores"
- pilar: qual dos 4 pilares tematicos cada post aborda (cada post DEVE ter pilar diferente)
- reasoning: 1-2 frases justificando a estrategia como um VP apresentaria ao board
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

  // HARD DEDUP: reject topics that are too similar to recent ones
  const recentTopicsList = recentPosts.map((p) => p.topic).filter(Boolean) as string[];
  const validatedTopics: string[] = [];

  for (const topic of strategy.topics) {
    if (!isTopicTooSimilar(topic, [...recentTopicsList, ...validatedTopics])) {
      validatedTopics.push(topic);
    } else {
      // Topic is too similar — try to regenerate just this one
      try {
        const replacement = await askGemini(
          `Gere UM único tema COMPLETAMENTE NOVO e DIFERENTE para um post de Facebook.
O tema NÃO pode ser parecido com NENHUM destes (proibidos): ${[...recentTopicsList, ...validatedTopics].slice(-30).join(', ')}
O tema deve ser sobre: ${strategy.focusType[validatedTopics.length] || 'educativo'}
${clientCtx ? `Nicho: ${clientCtx.niche}` : ''}
Retorne APENAS o tema em uma linha, sem aspas, sem explicação.`
        );
        const cleaned = replacement.trim().replace(/^["']|["']$/g, '');
        validatedTopics.push(cleaned || topic);
      } catch {
        validatedTopics.push(topic); // Keep original if regeneration fails
      }
    }
  }

  strategy.topics = validatedTopics;
  return strategy;
}

/**
 * Hard check: is a new topic too similar to recent ones?
 * Uses keyword overlap — if >40% of meaningful words match, it's too similar
 */
function isTopicTooSimilar(newTopic: string, recentTopics: string[]): boolean {
  const stopWords = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
    'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as', 'para', 'por', 'com', 'como',
    'que', 'e', 'ou', 'se', 'the', 'of', 'and', 'to', 'in', 'for', 'is', 'on', 'seu', 'sua']);

  const getWords = (text: string) =>
    new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w)));

  const newWords = getWords(newTopic);
  if (newWords.size === 0) return false;

  for (const recent of recentTopics) {
    const recentWords = getWords(recent);
    if (recentWords.size === 0) continue;

    let overlap = 0;
    for (const w of newWords) {
      if (recentWords.has(w)) overlap++;
    }

    const similarity = overlap / Math.min(newWords.size, recentWords.size);
    if (similarity >= 0.4) return true;
  }

  return false;
}
