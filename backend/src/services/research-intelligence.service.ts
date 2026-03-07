import prisma from '../config/database';
import * as nlm from '../modules/easyorios/core/notebooklm.service';

interface ResearchInsight {
  topic: string;
  summary: string;
  timestamp: string;
}

interface ResearchCache {
  insights: ResearchInsight[];
  updatedAt: string;
}

const DEDUP_SIMILARITY_THRESHOLD = 0.6;
const EXHAUSTED_THRESHOLD = 5; // times used before marking exhausted
const EVERGREEN_SCORE = 70; // performance score to mark as evergreen

const CACHE_KEY = 'notebooklm_research_cache';
const REPORT_KEY = 'notebooklm_weekly_report';
const TTL_MS = 48 * 60 * 60 * 1000; // 48h

export async function runResearchCycle(topic: string, userId: string): Promise<void> {
  try {
    const normalized = normalizeTopic(topic);

    // Check memory — skip if recently researched (< 24h)
    const existing = await prisma.researchMemory.findUnique({ where: { normalizedTopic: normalized } });
    if (existing && (Date.now() - existing.lastResearchedAt.getTime()) < 24 * 60 * 60 * 1000) {
      console.log(`[Research] Skipping "${topic}" — researched ${Math.round((Date.now() - existing.lastResearchedAt.getTime()) / 3600000)}h ago`);
      return;
    }

    console.log(`[Research] Starting cycle for topic: "${topic}"`);

    await nlm.addResearch(topic);

    const askRes = await nlm.askNotebook(`Resuma os 5 principais insights sobre: ${topic}`);
    const summary = askRes.success && askRes.data ? String(askRes.data) : 'Sem insights disponíveis';

    const cache = await getCache();
    cache.insights.push({ topic, summary, timestamp: new Date().toISOString() });
    cache.updatedAt = new Date().toISOString();
    await saveCache(cache);

    // Upsert memory
    await prisma.researchMemory.upsert({
      where: { normalizedTopic: normalized },
      update: { summary, lastResearchedAt: new Date(), timesResearched: { increment: 1 } },
      create: { topic, normalizedTopic: normalized, summary, timesResearched: 1 },
    });

    console.log(`[Research] Cycle completed for: "${topic}"`);
  } catch (err: any) {
    console.error(`[Research] Cycle failed for "${topic}": ${err.message}`);
  }
}

export async function getResearchForStrategy(): Promise<string> {
  const cache = await getCache();
  const cutoff = Date.now() - TTL_MS;
  const fresh = cache.insights.filter(i => new Date(i.timestamp).getTime() > cutoff);

  if (fresh.length === 0) return '';

  const lines = fresh.slice(-5).map((i, idx) => `- Insight ${idx + 1} (${i.topic}): ${i.summary.slice(0, 200)}`);
  return `\nPESQUISA NOTEBOOKLM (insights reais de pesquisa — use como inspiração para temas):\n${lines.join('\n')}\nPRIORIZE criar temas baseados nesses insights quando relevante.`;
}

export async function getResearchForContent(topic: string): Promise<string> {
  const cache = await getCache();
  const cutoff = Date.now() - TTL_MS;
  const fresh = cache.insights.filter(i => new Date(i.timestamp).getTime() > cutoff);

  const keywords = topic.toLowerCase().split(/\s+/);
  const relevant = fresh.filter(i => {
    const text = `${i.topic} ${i.summary}`.toLowerCase();
    return keywords.some(k => k.length > 3 && text.includes(k));
  });

  if (relevant.length === 0) return '';

  const lines = relevant.slice(0, 3).map(i => `- ${i.topic}: ${i.summary.slice(0, 200)}`);
  return `\nDADOS DE PESQUISA (fonte: NotebookLM — use como base factual):\n${lines.join('\n')}`;
}

export async function generateWeeklyReport(userId: string): Promise<void> {
  try {
    console.log('[Research] Generating weekly report...');

    const reportRes = await nlm.generateArtifact('report', 'Relatório semanal: top temas, engagement, tendências');
    const audioRes = await nlm.generateArtifact('audio', 'Podcast: insights da semana da agência');

    await prisma.systemConfig.upsert({
      where: { key: REPORT_KEY },
      update: { value: JSON.stringify({
        reportId: reportRes.data?.id || null,
        audioId: audioRes.data?.id || null,
        generatedAt: new Date().toISOString(),
      }) },
      create: { key: REPORT_KEY, value: JSON.stringify({
        reportId: reportRes.data?.id || null,
        audioId: audioRes.data?.id || null,
        generatedAt: new Date().toISOString(),
      }) },
    });

    console.log('[Research] Weekly report generated');
  } catch (err: any) {
    console.error(`[Research] Weekly report failed: ${err.message}`);
  }
}

export async function getResearchMeta(): Promise<{ lastResearchAt: string | null; totalInsights: number; topTopics: string[] }> {
  const cache = await getCache();
  const cutoff = Date.now() - TTL_MS;
  const fresh = cache.insights.filter(i => new Date(i.timestamp).getTime() > cutoff);

  return {
    lastResearchAt: cache.updatedAt || null,
    totalInsights: fresh.length,
    topTopics: fresh.slice(-5).map(i => i.topic),
  };
}

// ── Topic Memory Layer ──

/** Called after a post is created with a topic */
export async function recordTopicUsage(topic: string): Promise<void> {
  try {
    const normalized = normalizeTopic(topic);
    const mem = await prisma.researchMemory.findUnique({ where: { normalizedTopic: normalized } });
    if (!mem) {
      // First time seeing this topic — create entry
      await prisma.researchMemory.create({
        data: { topic, normalizedTopic: normalized, timesUsed: 1, lastUsedInPost: new Date() },
      });
      return;
    }
    const newTimesUsed = mem.timesUsed + 1;
    const status = newTimesUsed >= EXHAUSTED_THRESHOLD && mem.performanceScore < EVERGREEN_SCORE
      ? 'exhausted' : mem.status === 'exhausted' && mem.performanceScore >= EVERGREEN_SCORE
      ? 'evergreen' : mem.status;
    await prisma.researchMemory.update({
      where: { normalizedTopic: normalized },
      data: { timesUsed: newTimesUsed, lastUsedInPost: new Date(), status },
    });
  } catch (err: any) {
    console.error(`[Research Memory] recordTopicUsage failed: ${err.message}`);
  }
}

/** Called by performance-learner after scoring a post */
export async function updateTopicPerformance(topic: string, score: number): Promise<void> {
  try {
    const normalized = normalizeTopic(topic);
    const mem = await prisma.researchMemory.findUnique({ where: { normalizedTopic: normalized } });
    if (!mem) return;
    // Rolling average
    const newScore = mem.timesUsed > 0
      ? (mem.performanceScore * (mem.timesUsed - 1) + score) / mem.timesUsed
      : score;
    const status = newScore >= EVERGREEN_SCORE ? 'evergreen' : mem.status;
    await prisma.researchMemory.update({
      where: { normalizedTopic: normalized },
      data: { performanceScore: newScore, status },
    });
  } catch (err: any) {
    console.error(`[Research Memory] updateTopicPerformance failed: ${err.message}`);
  }
}

/** Returns smart topic recommendations for the strategist */
export async function getTopicRecommendations(): Promise<string> {
  try {
    const [evergreen, highPerf, exhausted] = await Promise.all([
      prisma.researchMemory.findMany({
        where: { status: 'evergreen' },
        orderBy: { performanceScore: 'desc' },
        take: 5,
      }),
      prisma.researchMemory.findMany({
        where: { performanceScore: { gte: 50 }, status: 'active' },
        orderBy: { performanceScore: 'desc' },
        take: 5,
      }),
      prisma.researchMemory.findMany({
        where: { status: 'exhausted' },
        select: { topic: true },
        take: 10,
      }),
    ]);

    const lines: string[] = [];

    if (evergreen.length > 0) {
      lines.push('TEMAS EVERGREEN (alto desempenho consistente — reutilize com variação):');
      evergreen.forEach(t => lines.push(`  - "${t.topic}" (score: ${t.performanceScore.toFixed(0)}, usado ${t.timesUsed}x)`));
    }
    if (highPerf.length > 0) {
      lines.push('TEMAS DE ALTO DESEMPENHO (explore mais):');
      highPerf.forEach(t => lines.push(`  - "${t.topic}" (score: ${t.performanceScore.toFixed(0)}, usado ${t.timesUsed}x)`));
    }
    if (exhausted.length > 0) {
      lines.push(`TEMAS ESGOTADOS (EVITE — já usados demais): ${exhausted.map(t => `"${t.topic}"`).join(', ')}`);
    }

    if (lines.length === 0) return '';
    return '\nMEMÓRIA DE TÓPICOS (histórico de performance real):\n' + lines.join('\n');
  } catch {
    return '';
  }
}

/** Check if topic is similar to an existing one (dedup) */
export async function findSimilarTopic(topic: string): Promise<{ topic: string; performanceScore: number; timesUsed: number; status: string } | null> {
  try {
    const normalized = normalizeTopic(topic);
    const words = normalized.split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return null;

    const all = await prisma.researchMemory.findMany({ take: 100, orderBy: { lastResearchedAt: 'desc' } });
    for (const mem of all) {
      const memWords = mem.normalizedTopic.split(/\s+/).filter(w => w.length > 3);
      const overlap = words.filter(w => memWords.includes(w)).length;
      const similarity = overlap / Math.max(words.length, memWords.length);
      if (similarity >= DEDUP_SIMILARITY_THRESHOLD) {
        return { topic: mem.topic, performanceScore: mem.performanceScore, timesUsed: mem.timesUsed, status: mem.status };
      }
    }
    return null;
  } catch { return null; }
}

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ── Cache Helpers ──

async function getCache(): Promise<ResearchCache> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: CACHE_KEY } });
    if (row) return JSON.parse(row.value as string);
  } catch {}
  return { insights: [], updatedAt: '' };
}

async function saveCache(cache: ResearchCache): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: CACHE_KEY },
    update: { value: JSON.stringify(cache) },
    create: { key: CACHE_KEY, value: JSON.stringify(cache) },
  });
}
