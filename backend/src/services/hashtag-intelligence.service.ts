/**
 * Hashtag Intelligence Service — Self-Evolving Hashtag Selection
 *
 * Learns from engagement data which hashtags perform best:
 * - Tracks every hashtag used on every published post
 * - Correlates hashtag → engagement score from ContentPerformance
 * - Weighted selection: high-performing hashtags get picked more
 * - Category-aware: learns best hashtags PER content category
 * - Stores learned weights in SystemConfig (persists across restarts)
 *
 * Evolution cycle:
 * 1. Post published with hashtags → stored in ScheduledPost.hashtags
 * 2. Performance Learner collects engagement 48h later
 * 3. Hashtag Intelligence correlates hashtag → engagement
 * 4. Weights updated — winning hashtags get higher probability
 * 5. Next post uses evolved weights for smarter hashtag selection
 *
 * Zero extra LLM tokens. Pure data-driven evolution.
 */

import prisma from '../config/database';
import { agentLog } from '../agents/agent-logger';

// ─── Types ───────────────────────────────────────────────────

interface HashtagWeight {
  tag: string;
  weight: number;       // 0.1 to 5.0
  uses: number;
  totalEngagement: number;
  avgEngagement: number;
  categories: string[]; // which categories this hashtag appeared in
}

interface CategoryHashtags {
  category: string;
  topTags: string[];    // top 10 hashtags for this category
  avgScore: number;
}

interface HashtagWeights {
  global: HashtagWeight[];
  byCategory: CategoryHashtags[];
  totalPosts: number;
  lastEvolution: string;
  generation: number;
}

// ─── Config ──────────────────────────────────────────────────

const CONFIG_KEY = 'hashtag_intelligence_weights';
const MAX_TRACKED_HASHTAGS = 200;

// Seed hashtags — proven performers in Brazilian social media
// These serve as starting pool until the system has enough data
const SEED_HASHTAGS: Record<string, string[]> = {
  educativo: [
    'aprendizado', 'conhecimento', 'educacao', 'dicas', 'comoaprender',
    'desenvolvimentopessoal', 'mindset', 'habilidades', 'produtividade', 'crescimento',
    'inteligenciaemocional', 'lideranca', 'neurociencia', 'aprendacomoricos', 'mentalidadevencedora',
  ],
  engajamento: [
    'reflexao', 'vocesabia', 'verdadedificil', 'mudedeperspectiva', 'pensediferente',
    'debate', 'opiniao', 'polemicainteligente', 'perspectiva', 'questaodebatedora',
    'desafio', 'oquevocefaria', 'concordaoudiscorda', 'dicadeouro', 'tabuderrubado',
  ],
  autoridade: [
    'tendencias', 'mercado', 'inovacao', 'tecnologia', 'futuro',
    'estrategia', 'negocios', 'dados', 'analise', 'inteligenciaartificial',
    'liderancadigital', 'transformacaodigital', 'marketingdigital', 'empreendedorismo', 'business',
  ],
  bastidores: [
    'bastidores', 'realidade', 'processos', 'rotina', 'diaadia',
    'transparencia', 'erroselicoes', 'historiareal', 'vulnerabilidade', 'jornada',
    'atrasdascourtinas', 'vidadoempreendedor', 'aprendizados', 'sejareal', 'autentico',
  ],
};

// Niche-specific seed hashtags
const NICHE_HASHTAGS: Record<string, string[]> = {
  telecom: [
    'planocelular', 'internet', 'TIM', 'CLARO', 'VIVO',
    'internetilimitada', 'celular', 'telecomunicacoes', 'economize', 'melhorplano',
  ],
};

// ─── Load / Save Weights ─────────────────────────────────────

async function loadWeights(): Promise<HashtagWeights> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
    if (config?.value) return config.value as any as HashtagWeights;
  } catch {}

  // Initialize with seed data
  const global: HashtagWeight[] = [];
  const allSeeds = new Set<string>();

  for (const [category, tags] of Object.entries(SEED_HASHTAGS)) {
    for (const tag of tags) {
      if (!allSeeds.has(tag)) {
        allSeeds.add(tag);
        global.push({
          tag,
          weight: 1.0,
          uses: 0,
          totalEngagement: 0,
          avgEngagement: 0,
          categories: [category],
        });
      } else {
        // Tag already exists — add category
        const existing = global.find(h => h.tag === tag);
        if (existing && !existing.categories.includes(category)) {
          existing.categories.push(category);
        }
      }
    }
  }

  return {
    global,
    byCategory: Object.keys(SEED_HASHTAGS).map(cat => ({
      category: cat,
      topTags: SEED_HASHTAGS[cat].slice(0, 10),
      avgScore: 0,
    })),
    totalPosts: 0,
    lastEvolution: new Date().toISOString(),
    generation: 0,
  };
}

async function saveWeights(weights: HashtagWeights): Promise<void> {
  try {
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: weights as any },
      create: { key: CONFIG_KEY, value: weights as any },
    });
  } catch (err: any) {
    console.error(`[HashtagIntelligence] Failed to save weights: ${err.message}`);
  }
}

// ─── Weighted Random Selection ───────────────────────────────

function weightedRandomMultiple(items: HashtagWeight[], count: number): HashtagWeight[] {
  if (items.length <= count) return [...items];

  const selected: HashtagWeight[] = [];
  const remaining = [...items];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].weight;
      if (random <= 0) {
        selected.push(remaining[j]);
        remaining.splice(j, 1);
        break;
      }
    }

    // Safety: if loop didn't select (floating point edge), pick last
    if (selected.length <= i) {
      const last = remaining.pop();
      if (last) selected.push(last);
    }
  }

  return selected;
}

// ─── Parse hashtags from stored string ───────────────────────

function parseHashtags(hashtagStr: string | null): string[] {
  if (!hashtagStr) return [];
  return hashtagStr
    .split(/\s+/)
    .map(h => h.replace(/^#/, '').toLowerCase().trim())
    .filter(h => h.length > 2);
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Get smart hashtags based on learned performance data.
 * Combines: category-specific tags + globally top tags + exploration.
 *
 * @param topic - Post topic (for context)
 * @param category - Content category (educativo, engajamento, etc.)
 * @param count - Number of hashtags to return (default 5)
 * @param niche - Optional niche for niche-specific tags
 */
export async function getSmartHashtags(
  topic: string,
  category: string,
  count: number = 5,
  niche?: string
): Promise<string[]> {
  const weights = await loadWeights();

  // 1. Get category-specific hashtags (60% of selection)
  const categoryTags = weights.global.filter(h =>
    h.categories.includes(category) && h.weight > 0
  );

  // 2. Get globally high-performing hashtags (30% of selection)
  const globalTop = [...weights.global]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 30);

  // 3. Calculate selection split
  const categoryCount = Math.max(1, Math.ceil(count * 0.6));
  const globalCount = Math.max(1, Math.ceil(count * 0.3));
  const explorationCount = Math.max(0, count - categoryCount - globalCount);

  const selected = new Set<string>();

  // Category selection (weighted random)
  if (categoryTags.length > 0) {
    const picked = weightedRandomMultiple(categoryTags, categoryCount);
    picked.forEach(h => selected.add(h.tag));
  }

  // Global top selection (fill remaining from global pool)
  const globalFiltered = globalTop.filter(h => !selected.has(h.tag));
  if (globalFiltered.length > 0) {
    const picked = weightedRandomMultiple(globalFiltered, globalCount);
    picked.forEach(h => selected.add(h.tag));
  }

  // Exploration: random from pool (keeps discovering new winners)
  if (explorationCount > 0) {
    const unexplored = weights.global.filter(h =>
      !selected.has(h.tag) && h.uses < 5
    );
    if (unexplored.length > 0) {
      const shuffled = unexplored.sort(() => Math.random() - 0.5);
      shuffled.slice(0, explorationCount).forEach(h => selected.add(h.tag));
    }
  }

  // Add niche-specific tags if available (bonus — doesn't count toward limit)
  if (niche) {
    const nicheKey = Object.keys(NICHE_HASHTAGS).find(k =>
      niche.toLowerCase().includes(k)
    );
    if (nicheKey) {
      const nicheTags = NICHE_HASHTAGS[nicheKey];
      // Add 1-2 niche tags
      const shuffled = nicheTags.sort(() => Math.random() - 0.5);
      shuffled.slice(0, 2).forEach(t => selected.add(t));
    }
  }

  // Ensure we hit the count (fill from seeds if needed)
  if (selected.size < count) {
    const seeds = SEED_HASHTAGS[category] || SEED_HASHTAGS.educativo;
    const shuffled = seeds.sort(() => Math.random() - 0.5);
    for (const tag of shuffled) {
      if (selected.size >= count) break;
      selected.add(tag);
    }
  }

  // Extract topic keywords and try to include 1 topic-related tag
  const topicWords = topic.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4);
  if (topicWords.length > 0) {
    const topicTag = topicWords[0].replace(/[^a-z0-9]/g, '');
    if (topicTag.length > 3) {
      selected.add(topicTag);
    }
  }

  return Array.from(selected).slice(0, count);
}

/**
 * Record hashtag usage after post creation.
 * Called by the content pipeline to track which hashtags are used.
 */
export async function recordHashtagUsage(
  postId: string,
  hashtags: string[],
  category: string
): Promise<void> {
  try {
    const weights = await loadWeights();
    const normalizedTags = hashtags.map(h => h.replace(/^#/, '').toLowerCase().trim());

    for (const tag of normalizedTags) {
      if (tag.length < 3) continue;

      const existing = weights.global.find(h => h.tag === tag);
      if (existing) {
        existing.uses++;
        if (!existing.categories.includes(category)) {
          existing.categories.push(category);
        }
      } else {
        // New hashtag discovered (from LLM generation) — add to pool
        weights.global.push({
          tag,
          weight: 1.0,
          uses: 1,
          totalEngagement: 0,
          avgEngagement: 0,
          categories: [category],
        });
      }
    }

    // Trim to max size (remove lowest-weight, least-used tags)
    if (weights.global.length > MAX_TRACKED_HASHTAGS) {
      weights.global.sort((a, b) => {
        // Keep high-weight and high-use tags
        const scoreA = a.weight * 2 + a.uses * 0.5;
        const scoreB = b.weight * 2 + b.uses * 0.5;
        return scoreB - scoreA;
      });
      weights.global = weights.global.slice(0, MAX_TRACKED_HASHTAGS);
    }

    weights.totalPosts++;
    await saveWeights(weights);
  } catch (err: any) {
    console.error(`[HashtagIntelligence] Record failed: ${err.message}`);
  }
}

/**
 * Evolve hashtag weights based on performance data.
 * Called by Performance Learner after collecting engagement metrics.
 *
 * Algorithm:
 * 1. Get all published posts with hashtags + engagement data (last 30 days)
 * 2. Parse hashtags from each post
 * 3. Calculate avg engagement per hashtag
 * 4. Update weights: hashtags on high-engagement posts get boosted
 * 5. Never drop below 0.1 (always keep exploration)
 */
export async function evolveHashtagWeights(): Promise<{
  generation: number;
  hashtagsUpdated: number;
  topHashtags: string[];
  newDiscovered: number;
}> {
  const weights = await loadWeights();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get published posts with hashtags
  const posts = await prisma.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: thirtyDaysAgo },
      hashtags: { not: null },
    },
    select: { id: true, hashtags: true, contentType: true },
  });

  // Get performance data
  const perfData = await prisma.contentPerformance.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      engagementScore: { gt: 0 },
    },
  });

  if (perfData.length < 3) {
    return { generation: weights.generation, hashtagsUpdated: 0, topHashtags: [], newDiscovered: 0 };
  }

  // Build hashtag → engagement scores map
  const hashtagScores = new Map<string, number[]>();
  const perfMap = new Map(perfData.map(p => [p.postId, p.engagementScore]));

  for (const post of posts) {
    const score = perfMap.get(post.id);
    if (score === undefined) continue;

    const tags = parseHashtags(post.hashtags);
    for (const tag of tags) {
      if (!hashtagScores.has(tag)) hashtagScores.set(tag, []);
      hashtagScores.get(tag)!.push(score);
    }
  }

  if (hashtagScores.size === 0) {
    return { generation: weights.generation, hashtagsUpdated: 0, topHashtags: [], newDiscovered: 0 };
  }

  // Calculate global average engagement
  const allScores = perfData.map(p => p.engagementScore);
  const globalAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;

  let hashtagsUpdated = 0;
  let newDiscovered = 0;

  // Update existing weights + discover new hashtags
  for (const [tag, scores] of hashtagScores) {
    if (scores.length < 1) continue;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const ratio = globalAvg > 0 ? avg / globalAvg : 1;
    const newWeight = Math.max(0.1, Math.min(5.0, ratio));

    const existing = weights.global.find(h => h.tag === tag);
    if (existing) {
      existing.totalEngagement = scores.reduce((a, b) => a + b, 0);
      existing.avgEngagement = avg;
      existing.weight = newWeight;
      hashtagsUpdated++;
    } else {
      // New hashtag from LLM that wasn't in seed pool — add it
      weights.global.push({
        tag,
        weight: newWeight,
        uses: scores.length,
        totalEngagement: scores.reduce((a, b) => a + b, 0),
        avgEngagement: avg,
        categories: [],
      });
      newDiscovered++;
      hashtagsUpdated++;
    }
  }

  // Update category-level top tags
  const categoryMap = new Map<string, { tag: string; avgEng: number }[]>();

  for (const hw of weights.global) {
    if (hw.avgEngagement <= 0) continue;
    for (const cat of hw.categories) {
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push({ tag: hw.tag, avgEng: hw.avgEngagement });
    }
  }

  weights.byCategory = Array.from(categoryMap.entries()).map(([category, tags]) => {
    const sorted = tags.sort((a, b) => b.avgEng - a.avgEng);
    return {
      category,
      topTags: sorted.slice(0, 10).map(t => t.tag),
      avgScore: sorted.reduce((sum, t) => sum + t.avgEng, 0) / sorted.length,
    };
  });

  // Trim global pool
  if (weights.global.length > MAX_TRACKED_HASHTAGS) {
    weights.global.sort((a, b) => (b.weight * 2 + b.uses * 0.5) - (a.weight * 2 + a.uses * 0.5));
    weights.global = weights.global.slice(0, MAX_TRACKED_HASHTAGS);
  }

  // Increment generation
  weights.generation++;
  weights.lastEvolution = new Date().toISOString();
  await saveWeights(weights);

  const topHashtags = [...weights.global]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(h => h.tag);

  await agentLog('HashtagIntelligence', `Evolution gen ${weights.generation}: ${hashtagsUpdated} hashtags updated, ${newDiscovered} new discovered. Top: ${topHashtags.join(', ')}`, { type: 'result' });

  return { generation: weights.generation, hashtagsUpdated, topHashtags, newDiscovered };
}

/**
 * Get current intelligence status (for debugging/monitoring)
 */
export async function getHashtagIntelligenceStatus(): Promise<HashtagWeights> {
  return loadWeights();
}
