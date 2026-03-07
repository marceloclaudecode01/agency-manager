import { askGemini } from '../../../agents/gemini';
import { CommandResult } from './module.interface';
import prisma from '../../../config/database';

// ── Capability Catalog ──

interface Capability {
  id: string;
  description: string;
  category: string;
  execute: (params: Record<string, any>) => Promise<any>;
}

interface NeuralStep {
  step: number;
  capabilityId: string;
  params: Record<string, any>;
  description: string;
}

interface NeuralSuggestion {
  title: string;
  description: string;
  requirements: string[];
  effort: string;
}

interface NeuralPlan {
  canExecute: boolean;
  plan: NeuralStep[];
  suggestion?: NeuralSuggestion;
}

const capabilities: Capability[] = [
  {
    id: 'build_strategy',
    description: 'Gerar estratégia diária de conteúdo (tópicos, tipos de post, horários)',
    category: 'content',
    execute: async () => {
      const { buildDailyStrategy } = await import('../../../agents/content-strategist.agent');
      return buildDailyStrategy();
    },
  },
  {
    id: 'generate_post',
    description: 'Criar um post completo dado topic (string) e focusType (string). Params: topic, focusType',
    category: 'content',
    execute: async (p) => {
      const { generatePostFromStrategy } = await import('../../../agents/content-creator.agent');
      return generatePostFromStrategy(p.topic || 'marketing digital', p.focusType || 'educativo', []);
    },
  },
  {
    id: 'enhance_viral',
    description: 'Melhorar post com mecânicas virais. Params: message (texto do post), topic, category',
    category: 'content',
    execute: async (p) => {
      const { enhanceWithViralMechanics } = await import('../../../agents/viral-mechanics.agent');
      return enhanceWithViralMechanics(p.message || '', p.topic || '', p.category || 'educativo');
    },
  },
  {
    id: 'check_viral_score',
    description: 'Verificar score viral (0-10) de um texto. Params: message',
    category: 'content',
    execute: async (p) => {
      const { getViralScore } = await import('../../../agents/viral-mechanics.agent');
      return { score: await getViralScore(p.message || '') };
    },
  },
  {
    id: 'generate_video',
    description: 'Gerar vídeo a partir de texto. Params: message, topic, category (opcional), imageUrl (opcional)',
    category: 'media',
    execute: async (p) => {
      const { generatePremiumVideo } = await import('../../../services/video-from-text.service');
      return generatePremiumVideo(p.message || '', p.topic || '', p.category, p.imageUrl);
    },
  },
  {
    id: 'generate_image',
    description: 'Gerar imagem AI para post. Params: topic, category, postMessage (opcional)',
    category: 'media',
    execute: async (p) => {
      const { generateImageForPost } = await import('../../../agents/image-generator.agent');
      return generateImageForPost(p.topic || '', p.category || 'educativo', p.postMessage);
    },
  },
  {
    id: 'get_brand_context',
    description: 'Obter contexto da marca (identidade, tom, público-alvo)',
    category: 'brand',
    execute: async () => {
      const { getBrandContext } = await import('../../../agents/brand-brain.agent');
      return { context: await getBrandContext() };
    },
  },
  {
    id: 'get_smart_hashtags',
    description: 'Gerar hashtags inteligentes. Params: topic, category, count (opcional)',
    category: 'content',
    execute: async (p) => {
      const { getSmartHashtags } = await import('../../../services/hashtag-intelligence.service');
      return { hashtags: await getSmartHashtags(p.topic || '', p.category || '', p.count) };
    },
  },
  {
    id: 'get_trending',
    description: 'Analisar tópicos em tendência. Params: niche (opcional), targetAudience (opcional)',
    category: 'research',
    execute: async (p) => {
      const { analyzeTrendingTopics } = await import('../../../agents/trending-topics.agent');
      return analyzeTrendingTopics(p.niche, p.targetAudience);
    },
  },
  {
    id: 'weekly_strategy',
    description: 'Gerar estratégia semanal completa de crescimento',
    category: 'strategy',
    execute: async () => {
      const { generateWeeklyStrategy } = await import('../../../agents/growth-director.agent');
      return generateWeeklyStrategy();
    },
  },
  {
    id: 'check_token',
    description: 'Verificar status do token do Facebook (válido/expirado)',
    category: 'system',
    execute: async () => {
      const { checkFacebookToken } = await import('../../../agents/token-monitor.agent');
      return checkFacebookToken();
    },
  },
  {
    id: 'list_recent_posts',
    description: 'Listar posts recentes. Params: limit (opcional, default 10), status (opcional: scheduled/published/failed)',
    category: 'data',
    execute: async (p) => {
      const where: any = {};
      if (p.status) where.status = p.status;
      if (p.today) {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        where.scheduledFor = { gte: start, lte: end };
      }
      const posts = await prisma.scheduledPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: p.limit || 10,
        select: {
          id: true, message: true, status: true, scheduledFor: true,
          qualityScore: true, viralScore: true,
          publishedAt: true, createdAt: true,
        },
      });
      return { count: posts.length, posts };
    },
  },
  {
    id: 'get_post_quality',
    description: 'Obter qualidade média dos posts recentes. Params: days (opcional, default 7)',
    category: 'data',
    execute: async (p) => {
      const since = new Date(Date.now() - (p.days || 7) * 24 * 60 * 60 * 1000);
      const result = await prisma.scheduledPost.aggregate({
        where: { createdAt: { gte: since } },
        _avg: { qualityScore: true, viralScore: true },
        _count: true,
      });
      return {
        avgQuality: result._avg.qualityScore ? +result._avg.qualityScore.toFixed(1) : null,
        avgViral: result._avg.viralScore ? +result._avg.viralScore.toFixed(1) : null,
        totalPosts: result._count,
      };
    },
  },
  {
    id: 'count_by_status',
    description: 'Contagem de posts agrupados por status (scheduled, published, failed, etc)',
    category: 'data',
    execute: async () => {
      const groups = await prisma.scheduledPost.groupBy({
        by: ['status'],
        _count: true,
      });
      const counts: Record<string, number> = {};
      for (const g of groups) counts[g.status] = g._count;
      return counts;
    },
  },
];

// ── Capability Map ──
const capabilityMap = new Map(capabilities.map(c => [c.id, c]));

// ── Param Reference Resolver ──
function resolveParamRef(value: any, results: Map<number, any>): any {
  if (typeof value !== 'string' || !value.startsWith('$step')) return value;
  // Parse $stepN.path.to.field or $stepN.array[0]
  const match = value.match(/^\$step(\d+)\.(.+)$/);
  if (!match) return value;
  const stepNum = parseInt(match[1]);
  const path = match[2];
  const stepResult = results.get(stepNum);
  if (!stepResult) return value;

  // Navigate path
  let current: any = stepResult;
  for (const segment of path.split('.')) {
    if (current == null) return value;
    const arrMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      current = current[arrMatch[1]];
      if (Array.isArray(current)) current = current[parseInt(arrMatch[2])];
      else return value;
    } else {
      current = current[segment];
    }
  }
  return current ?? value;
}

// ── Plan Actions via LLM ──
async function planActions(userMessage: string): Promise<NeuralPlan> {
  const catalog = capabilities
    .map(c => `- ${c.id}: ${c.description} [${c.category}]`)
    .join('\n');

  const prompt = `Voce e o planejador neural do Easyorios. Dado o pedido do usuario, crie um plano usando as capabilities disponiveis.

CAPABILITIES:
${catalog}

PEDIDO: "${userMessage}"

Responda APENAS um JSON valido (sem markdown, sem backticks):
Se consegue executar:
{"canExecute":true,"plan":[{"step":1,"capabilityId":"id","params":{},"description":"descricao"}]}

Params podem referenciar resultados anteriores: "$step1.field", "$step1.array[0]"

Se NAO consegue executar com as capabilities disponiveis:
{"canExecute":false,"plan":[],"suggestion":{"title":"Nome","description":"O que fazer","requirements":["item"],"effort":"X horas"}}

IMPORTANTE:
- Use APENAS capabilities listadas acima
- Minimo de steps necessarios
- Se o pedido e simples (ex: listar posts), use 1 step
- Se e complexo (ex: testar pipeline), use multiplos steps em sequencia`;

  const raw = await askGemini(prompt);
  if (!raw) throw new Error('Empty LLM response');

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]) as NeuralPlan;
  // Validate
  if (typeof parsed.canExecute !== 'boolean') throw new Error('Invalid plan format');
  if (parsed.canExecute && (!Array.isArray(parsed.plan) || parsed.plan.length === 0)) {
    throw new Error('canExecute=true but no plan steps');
  }
  // Validate all capability IDs exist
  for (const step of parsed.plan) {
    if (!capabilityMap.has(step.capabilityId)) {
      throw new Error(`Unknown capability: ${step.capabilityId}`);
    }
  }
  return parsed;
}

// ── Execute Plan ──
async function executePlan(plan: NeuralPlan): Promise<CommandResult> {
  if (!plan.canExecute) {
    return {
      command: 'neural_suggestion',
      success: true,
      message: `Sugestão de implementação: ${plan.suggestion?.title}`,
      data: plan.suggestion,
    };
  }

  const results = new Map<number, any>();
  const stepSummaries: string[] = [];

  for (const step of plan.plan) {
    const cap = capabilityMap.get(step.capabilityId)!;
    // Resolve param references
    const resolvedParams: Record<string, any> = {};
    for (const [key, val] of Object.entries(step.params || {})) {
      resolvedParams[key] = resolveParamRef(val, results);
    }

    try {
      const result = await cap.execute(resolvedParams);
      results.set(step.step, result);
      stepSummaries.push(`✓ Step ${step.step}: ${step.description}`);
    } catch (e: any) {
      stepSummaries.push(`✗ Step ${step.step}: ${step.description} — ERRO: ${e.message}`);
      // Continue with remaining steps
    }
  }

  // Build final result from last successful step
  const lastStep = plan.plan[plan.plan.length - 1];
  const finalResult = results.get(lastStep.step);

  return {
    command: 'neural_plan',
    success: true,
    message: `Plano neural executado (${plan.plan.length} steps):\n${stepSummaries.join('\n')}`,
    data: {
      steps: stepSummaries,
      results: Object.fromEntries(results),
      finalResult,
    },
  };
}

// ── Public Entry Point ──
export async function executeNeuralAction(
  userMessage: string,
  _userId: string,
): Promise<CommandResult | null> {
  try {
    const plan = await planActions(userMessage);
    return executePlan(plan);
  } catch (e: any) {
    console.error('[NeuralPlanner] Error:', e.message);
    return null;
  }
}
