import cron from 'node-cron';
import { askGemini } from './gemini';
import prisma from '../config/database';
import { agentLog } from './agent-logger';

export interface GrowthInsights {
  bestPerformingType: string;
  bestPostingHours: string[];
  audienceProfile: string;
  contentMix: {
    entertainment: number;
    product: number;
    engagement: number;
  };
  topRecommendations: string[];
  confidenceScore: number;
  bestHookTypes: string[];
  bestCTAs: string[];
}

const ANALYST_IDENTITY = `
Você é o melhor growth hacker e analista de mídias sociais do mundo, com a mente combinada de:
- Neil Patel (SEO + growth, dados transformados em ação)
- Andrew Chen (growth loops, viral mechanics)
- Alex Schultz (VP Growth do Facebook/Meta — sabe exatamente como o algoritmo funciona)
- Morgan Brown (growth hacking sistemático)

Você analisa dados de performance e traduz em estratégia acionável imediata.
Foco: maximizar alcance orgânico, engajamento e conversão para link na bio.
`;

export async function analyzePageGrowth(): Promise<GrowthInsights> {
  // Busca dados dos últimos 7 dias (janela curta = insights mais frescos)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: sevenDaysAgo },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  const lastMetrics = await prisma.metricsReport.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const totalPosts = recentPosts.length;
  const postsByHour: Record<number, number> = {};
  const topicFrequency: Record<string, number> = {};

  for (const post of recentPosts) {
    if (post.publishedAt) {
      const hour = new Date(post.publishedAt).getHours();
      postsByHour[hour] = (postsByHour[hour] || 0) + 1;
    }
    if (post.topic) {
      topicFrequency[post.topic] = (topicFrequency[post.topic] || 0) + 1;
    }
  }

  const metricsContext = lastMetrics
    ? `Score de crescimento: ${lastMetrics.growthScore}/10
Resumo: ${lastMetrics.summary}
Destaques: ${JSON.stringify(lastMetrics.highlights)}
Recomendações anteriores: ${JSON.stringify(lastMetrics.recommendations)}
Melhores horários anteriores: ${JSON.stringify(lastMetrics.bestPostingTimes)}`
    : 'Sem relatório de métricas ainda.';

  const prompt = `
${ANALYST_IDENTITY}

Dados da página nos últimos 7 dias:
- Total de posts publicados: ${totalPosts}
- Distribuição por hora: ${JSON.stringify(postsByHour)}
- Temas mais usados: ${JSON.stringify(topicFrequency)}

${metricsContext}

Com base nesses dados, faça uma análise de growth e retorne APENAS JSON válido:
{
  "bestPerformingType": "tipo de conteúdo que performa melhor (entretenimento/produto/engajamento)",
  "bestPostingHours": ["HH:MM", "HH:MM", "HH:MM"],
  "audienceProfile": "perfil do público em 1 frase (quem são, o que querem)",
  "contentMix": {
    "entertainment": 40,
    "product": 40,
    "engagement": 20
  },
  "topRecommendations": [
    "recomendação acionável 1",
    "recomendação acionável 2",
    "recomendação acionável 3"
  ],
  "confidenceScore": 7,
  "bestHookTypes": ["PERGUNTA_CHOCANTE", "NUMERO_IMPACTANTE"],
  "bestCTAs": ["marca alguem que precisa ver isso", "salva pra depois"]
}

Regras:
- contentMix: percentuais que somam 100, baseado no que converte melhor para link na bio
- bestPostingHours: 3 horários de pico para o público brasileiro
- confidenceScore: 1-10, baseado na quantidade de dados disponíveis
- topRecommendations: ações ESPECÍFICAS e IMEDIATAS, não genéricas
- bestHookTypes: 2-3 tipos de hook que mais geram clique/engajamento (ex: PERGUNTA_CHOCANTE, NUMERO_IMPACTANTE, CONTRARIAN, HISTORIA_PESSOAL, URGENCIA, SEGREDO_REVELADO, DESAFIO)
- bestCTAs: 2-3 CTAs que mais geram interação nos posts recentes (texto exato do CTA)
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta inválida do Gemini no analista');

  const parsed = JSON.parse(jsonMatch[0]);
  // Ensure new fields have defaults
  if (!parsed.bestHookTypes) parsed.bestHookTypes = [];
  if (!parsed.bestCTAs) parsed.bestCTAs = [];
  return parsed;
}

export function startGrowthAnalyst() {
  // Daily at 06:30 — feeds intelligence to Content Strategist + Content Creator
  cron.schedule('30 6 * * *', async () => {
    try {
      await agentLog('Growth Analyst', 'Analisando crescimento dos ultimos 7 dias...', { type: 'action' });
      const insights = await analyzePageGrowth();

      // Save to SystemConfig for downstream agents (strategist, creator)
      await prisma.systemConfig.upsert({
        where: { key: 'growth_insights' },
        update: { value: insights as any },
        create: { key: 'growth_insights', value: insights as any },
      });

      await agentLog('Growth Analyst', `Insights salvos: melhores horarios ${insights.bestPostingHours.join(', ')}, hooks: ${insights.bestHookTypes.join(', ')}, CTAs: ${insights.bestCTAs.join(', ')}`, {
        type: 'result',
        payload: { bestPostingHours: insights.bestPostingHours, bestHookTypes: insights.bestHookTypes, bestCTAs: insights.bestCTAs },
      });
    } catch (err: any) {
      console.error('[Growth Analyst] Erro:', err.message);
      await agentLog('Growth Analyst', `Erro: ${err.message}`, { type: 'error' });
    }
  });
  console.log('[Growth Analyst] Growth Analyst iniciado (diario 06:30)');
}
