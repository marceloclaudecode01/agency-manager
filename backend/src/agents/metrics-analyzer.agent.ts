import { askGemini } from './gemini';

const PAGE_CONTEXT = `
Você é o analista de marketing desta página no Facebook.
Analise os dados fornecidos e gere insights práticos em português do Brasil.
Seja direto, use linguagem simples (o dono da página é leigo em marketing digital).
`;

export interface MetricsReport {
  summary: string;
  highlights: string[];
  recommendations: string[];
  bestPostingTimes: string[];
  growthScore: number;
  engagementScore: number;  // 1-10: qualidade das interações
  commercialScore: number;  // 1-10: potencial de conversão/monetização
  riskScore: number;        // 1-10: nível de risco reputacional (1=baixo, 10=alto)
}

export async function analyzeMetrics(metrics: {
  followers: number;
  followersPrev: number;
  reach: number;
  engagement: number;
  posts: any[];
}): Promise<MetricsReport> {
  const followerGrowth = metrics.followers - (metrics.followersPrev || metrics.followers);
  const engagementRate = metrics.reach > 0
    ? ((metrics.engagement / metrics.reach) * 100).toFixed(1)
    : '0';

  const prompt = `
${PAGE_CONTEXT}

Dados da página esta semana:
- Seguidores: ${metrics.followers} (crescimento: ${followerGrowth > 0 ? '+' : ''}${followerGrowth})
- Alcance total: ${metrics.reach} pessoas
- Taxa de engajamento: ${engagementRate}%
- Posts publicados: ${metrics.posts.length}

Gere uma análise e retorne APENAS um JSON válido neste formato:
{
  "summary": "resumo de 2 frases sobre o desempenho geral",
  "highlights": ["ponto positivo 1", "ponto positivo 2"],
  "recommendations": ["ação recomendada 1", "ação recomendada 2", "ação recomendada 3"],
  "bestPostingTimes": ["19:00", "21:00"],
  "growthScore": 7,
  "engagementScore": 6,
  "commercialScore": 5,
  "riskScore": 2
}

growthScore: nota de 1 a 10 para o crescimento geral (seguidores, alcance).
engagementScore: nota de 1 a 10 para qualidade das interações (comentários, compartilhamentos, salvamentos).
commercialScore: nota de 1 a 10 para potencial de conversão/monetização (cliques em links, intenção de compra nos comentários).
riskScore: nota de 1 a 10 para risco reputacional (1=baixo risco, 10=alto risco — comentários negativos, crises, queda brusca).
`;

  const raw = await askGemini(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid response from Gemini');
  return JSON.parse(jsonMatch[0]);
}
