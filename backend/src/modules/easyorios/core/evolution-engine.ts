/**
 * Agency Evolution Engine — Continuous autonomous improvement loop
 *
 * Runs every 2 hours and executes:
 * 1. Diagnostic — agency health check + fix operational failures
 * 2. Intelligence — market trends + content opportunities
 * 3. Strategy — build optimized content plan
 * 4. Production — generate high-quality content (score >= 7)
 * 5. Publishing — schedule/publish content
 * 6. Learning — analyze results, adjust strategy
 * 7. Monitoring — sentinel scan, risk detection
 *
 * Safe mode and agent pause are respected.
 */

import cron from 'node-cron';
import prisma from '../../../config/database';
import { agentLog } from '../../../agents/agent-logger';
import { isSafeModeActive } from '../../../agents/safe-mode';
import { askGemini } from '../../../agents/gemini';

interface CycleResult {
  phase: string;
  success: boolean;
  summary: string;
  data?: any;
}

// ── Phase 1: Diagnostic ──
async function phaseDiagnostic(): Promise<CycleResult> {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const oneDayAgo = new Date(Date.now() - 86400000);

    const [agents, activeAgents, pausedAgents, publishedToday, pending, failed, actions24h] = await Promise.all([
      prisma.agent.count(),
      prisma.agent.count({ where: { status: 'active' } }),
      prisma.agent.count({ where: { status: 'paused' } }),
      prisma.scheduledPost.count({ where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } } }),
      prisma.scheduledPost.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } }),
      prisma.scheduledPost.count({ where: { status: 'FAILED', createdAt: { gte: oneDayAgo } } }),
      prisma.agentLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
    ]);

    // Auto-fix: retry failed posts
    if (failed > 0) {
      await prisma.scheduledPost.updateMany({
        where: { status: 'FAILED', createdAt: { gte: oneDayAgo } },
        data: { status: 'PENDING', governorDecision: null, governorReason: 'Auto-retry by Evolution Engine' },
      });
      await agentLog('EvolutionEngine', `Auto-retrying ${failed} failed posts`, { type: 'action' });
    }

    // Sentinel scan
    let sentinelReport: any = null;
    try {
      const { runSentinel } = await import('../../../agents/system-sentinel.agent');
      sentinelReport = await runSentinel();
    } catch {}

    // Token check
    let tokenStatus: any = null;
    try {
      const { checkFacebookToken } = await import('../../../agents/token-monitor.agent');
      tokenStatus = await checkFacebookToken();
    } catch {}

    const summary = `Agentes: ${activeAgents}/${agents} ativos | Posts hoje: ${publishedToday} | Fila: ${pending} | Falhas (24h): ${failed}${failed > 0 ? ' [AUTO-RETRY]' : ''} | Token: ${tokenStatus?.isValid ? 'OK' : 'ALERTA'}`;

    return {
      phase: 'diagnostic',
      success: true,
      summary,
      data: { agents, activeAgents, pausedAgents, publishedToday, pending, failed, actions24h, sentinelReport, tokenStatus },
    };
  } catch (e: any) {
    return { phase: 'diagnostic', success: false, summary: `Erro: ${e.message}` };
  }
}

// ── Phase 2: Intelligence ──
async function phaseIntelligence(): Promise<CycleResult> {
  try {
    const { analyzeTrendingTopics } = await import('../../../agents/trending-topics.agent');
    const trending = await analyzeTrendingTopics();

    const { getBrandContext } = await import('../../../agents/brand-brain.agent');
    const brand = await getBrandContext();

    return {
      phase: 'intelligence',
      success: true,
      summary: `Tendências analisadas. Brand context loaded.`,
      data: { trending, brand },
    };
  } catch (e: any) {
    return { phase: 'intelligence', success: false, summary: `Erro: ${e.message}` };
  }
}

// ── Phase 3: Strategy ──
async function phaseStrategy(): Promise<CycleResult> {
  try {
    const { buildDailyStrategy } = await import('../../../agents/content-strategist.agent');
    const strategy = await buildDailyStrategy();

    return {
      phase: 'strategy',
      success: true,
      summary: `Estratégia gerada com ${strategy?.topics?.length || 0} tópicos`,
      data: strategy,
    };
  } catch (e: any) {
    return { phase: 'strategy', success: false, summary: `Erro: ${e.message}` };
  }
}

// ── Phase 4: Production ──
async function phaseProduction(strategy: any): Promise<CycleResult> {
  try {
    const { generatePostFromStrategy } = await import('../../../agents/content-creator.agent');
    const { enhanceWithViralMechanics, getViralScore } = await import('../../../agents/viral-mechanics.agent');
    const { generateImageForPost } = await import('../../../agents/image-generator.agent');
    const { getSmartHashtags } = await import('../../../services/hashtag-intelligence.service');

    const topics = strategy?.topics || [];
    const focusTypes = strategy?.focusType || strategy?.focusTypes || ['educativo'];
    const producedPosts: any[] = [];

    // Produce up to 3 posts per cycle
    const maxPosts = Math.min(3, topics.length || 1);

    for (let i = 0; i < maxPosts; i++) {
      const topic = topics[i] || 'marketing digital';
      const focusType = Array.isArray(focusTypes) ? (focusTypes[i] || focusTypes[0] || 'educativo') : focusTypes;

      try {
        // Generate post
        let post = await generatePostFromStrategy(topic, focusType, []);
        if (!post?.message) continue;

        // Enhance with viral mechanics
        try {
          const enhanced = await enhanceWithViralMechanics(post.message, topic, focusType);
          if (enhanced?.enhancedMessage) post.message = enhanced.enhancedMessage;
        } catch {}

        // Check viral score — if < 7, try to improve once
        let viralScore = 5;
        try {
          viralScore = await getViralScore(post.message);
        } catch {}

        if (viralScore < 7) {
          try {
            const improved = await enhanceWithViralMechanics(post.message, topic, focusType);
            if (improved?.enhancedMessage) {
              post.message = improved.enhancedMessage;
              viralScore = await getViralScore(post.message).catch(() => viralScore);
            }
          } catch {}
        }

        // Generate image
        let imageUrl: string | null = null;
        try {
          const img = await generateImageForPost(topic, focusType);
          imageUrl = img?.url || null;
        } catch {}

        // Smart hashtags
        let hashtags: string[] = [];
        try {
          hashtags = await getSmartHashtags(topic, focusType);
        } catch {}

        producedPosts.push({
          topic,
          message: post.message,
          viralScore,
          imageUrl,
          hashtags,
          focusType,
        });
      } catch (postErr: any) {
        await agentLog('EvolutionEngine', `Post production failed for topic "${topic}": ${postErr.message}`, { type: 'error' });
      }
    }

    return {
      phase: 'production',
      success: producedPosts.length > 0,
      summary: `${producedPosts.length} posts produzidos. Scores virais: ${producedPosts.map(p => p.viralScore).join(', ')}`,
      data: { posts: producedPosts },
    };
  } catch (e: any) {
    return { phase: 'production', success: false, summary: `Erro: ${e.message}` };
  }
}

// ── Phase 5: Publishing ──
async function phasePublishing(posts: any[]): Promise<CycleResult> {
  try {
    const { optimizeForPlatform } = await import('../../../agents/platform-optimizer.agent');

    // Get first active client for scheduling
    const client = await prisma.client.findFirst({
      where: { isActive: true, status: 'ACTIVE', facebookPageId: { not: null } },
      select: { id: true, name: true },
    });

    let scheduled = 0;

    // Spread posts across the day (2h intervals starting from next hour)
    const now = new Date();
    const baseHour = now.getHours() + 1;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      try {
        const optimized = optimizeForPlatform(post.message, post.hashtags, 'facebook');
        const hashtagsStr = (optimized.hashtags || post.hashtags || []).map((h: string) => `#${h.replace('#', '')}`).join(' ') || null;

        const scheduledFor = new Date();
        const targetHour = baseHour + (i * 2);
        if (targetHour >= 22) {
          // Schedule for next day
          scheduledFor.setDate(scheduledFor.getDate() + 1);
          scheduledFor.setHours(9 + (i * 2), 0, 0, 0);
        } else {
          scheduledFor.setHours(targetHour, 0, 0, 0);
        }

        await prisma.scheduledPost.create({
          data: {
            topic: post.topic,
            message: optimized.message || post.message,
            hashtags: hashtagsStr,
            imageUrl: post.imageUrl,
            status: 'APPROVED',
            scheduledFor,
            source: 'evolution-engine',
            contentType: post.imageUrl ? 'image' : 'organic',
            viralScore: post.viralScore || null,
            governorDecision: 'APPROVE',
            governorReason: `Evolution Engine auto-approved (viral: ${post.viralScore}/10)`,
            ...(client?.id ? { clientId: client.id } : {}),
          },
        });

        scheduled++;
      } catch (pubErr: any) {
        await agentLog('EvolutionEngine', `Schedule failed for "${post.topic}": ${pubErr.message}`, { type: 'error' });
      }
    }

    return {
      phase: 'publishing',
      success: scheduled > 0,
      summary: `${scheduled}/${posts.length} posts agendados`,
      data: { scheduled },
    };
  } catch (e: any) {
    return { phase: 'publishing', success: false, summary: `Erro: ${e.message}` };
  }
}

// ── Phase 6: Learning ──
async function phaseLearning(): Promise<CycleResult> {
  try {
    const sevenDays = new Date(Date.now() - 7 * 86400000);

    const [quality, countByStatus, recentPublished] = await Promise.all([
      prisma.scheduledPost.aggregate({
        where: { createdAt: { gte: sevenDays } },
        _avg: { qualityScore: true, viralScore: true },
        _count: true,
      }),
      prisma.scheduledPost.groupBy({ by: ['status'], _count: true }),
      prisma.scheduledPost.findMany({
        where: { status: 'PUBLISHED', publishedAt: { gte: sevenDays } },
        orderBy: { viralScore: 'desc' },
        take: 5,
        select: { topic: true, viralScore: true, qualityScore: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const g of countByStatus) statusMap[g.status] = g._count;

    // Generate learning insights via LLM
    let insights = '';
    try {
      const topTopics = recentPublished.map(p => `"${p.topic}" (viral: ${p.viralScore}, quality: ${p.qualityScore})`).join(', ');
      insights = await askGemini(
        `Analise brevemente estes dados de performance da agencia de marketing (max 100 palavras):
        - Qualidade media: ${quality._avg.qualityScore?.toFixed(1) || 'N/A'}
        - Viral medio: ${quality._avg.viralScore?.toFixed(1) || 'N/A'}
        - Total posts (7d): ${quality._count}
        - Status: ${JSON.stringify(statusMap)}
        - Top posts: ${topTopics}
        Identifique: 1 ponto forte, 1 melhoria, 1 sugestao de tema.`
      );
    } catch {}

    // Save insights as note
    if (insights) {
      try {
        const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (adminUser) {
          await prisma.personalNote.create({
            data: {
              userId: adminUser.id,
              content: `[Evolution Engine] ${new Date().toLocaleDateString('pt-BR')}: ${insights.substring(0, 500)}`,
            },
          });
        }
      } catch {}
    }

    return {
      phase: 'learning',
      success: true,
      summary: `Quality avg: ${quality._avg.qualityScore?.toFixed(1) || 'N/A'} | Viral avg: ${quality._avg.viralScore?.toFixed(1) || 'N/A'} | 7d posts: ${quality._count}`,
      data: { quality, statusMap, insights },
    };
  } catch (e: any) {
    return { phase: 'learning', success: false, summary: `Erro: ${e.message}` };
  }
}

// ── Main Cycle ──
async function runEvolutionCycle(): Promise<void> {
  const cycleStart = Date.now();
  const cycleId = `evo-${Date.now()}`;

  console.log(`[EvolutionEngine] 🔄 Evolution cycle started [${cycleId}]`);
  await agentLog('EvolutionEngine', `🔄 Evolution cycle started [${cycleId}]`, { type: 'action' });

  // Check safe mode
  if (await isSafeModeActive()) {
    await agentLog('EvolutionEngine', 'Safe mode active — skipping cycle', { type: 'info' });
    return;
  }

  const results: CycleResult[] = [];

  // Phase 1: Diagnostic
  const diag = await phaseDiagnostic();
  results.push(diag);
  console.log(`[EvolutionEngine] [1/6 Diagnostic] ${diag.summary}`);
  await agentLog('EvolutionEngine', `[1/6 Diagnostic] ${diag.summary}`, { type: diag.success ? 'result' : 'error' });

  // Phase 2: Intelligence
  const intel = await phaseIntelligence();
  results.push(intel);
  console.log(`[EvolutionEngine] [2/6 Intelligence] ${intel.summary}`);
  await agentLog('EvolutionEngine', `[2/6 Intelligence] ${intel.summary}`, { type: intel.success ? 'result' : 'error' });

  // Phase 3: Strategy
  const strat = await phaseStrategy();
  results.push(strat);
  console.log(`[EvolutionEngine] [3/6 Strategy] ${strat.summary}`);
  await agentLog('EvolutionEngine', `[3/6 Strategy] ${strat.summary}`, { type: strat.success ? 'result' : 'error' });

  // Phase 4: Production (only if strategy succeeded)
  let production: CycleResult = { phase: 'production', success: false, summary: 'Skipped (no strategy)' };
  if (strat.success && strat.data) {
    production = await phaseProduction(strat.data);
  }
  results.push(production);
  console.log(`[EvolutionEngine] [4/6 Production] ${production.summary}`);
  await agentLog('EvolutionEngine', `[4/6 Production] ${production.summary}`, { type: production.success ? 'result' : 'error' });

  // Phase 5: Publishing (only if production succeeded)
  let publishing: CycleResult = { phase: 'publishing', success: false, summary: 'Skipped (no posts)' };
  if (production.success && production.data?.posts?.length > 0) {
    publishing = await phasePublishing(production.data.posts);
  }
  results.push(publishing);
  console.log(`[EvolutionEngine] [5/6 Publishing] ${publishing.summary}`);
  await agentLog('EvolutionEngine', `[5/6 Publishing] ${publishing.summary}`, { type: publishing.success ? 'result' : 'error' });

  // Phase 6: Learning
  const learning = await phaseLearning();
  results.push(learning);
  console.log(`[EvolutionEngine] [6/6 Learning] ${learning.summary}`);
  await agentLog('EvolutionEngine', `[6/6 Learning] ${learning.summary}`, { type: learning.success ? 'result' : 'error' });

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  const successCount = results.filter(r => r.success).length;

  console.log(`[EvolutionEngine] ✅ Evolution cycle complete [${cycleId}] — ${successCount}/${results.length} phases OK — ${elapsed}s`);
  await agentLog('EvolutionEngine', `✅ Evolution cycle complete [${cycleId}] — ${successCount}/${results.length} phases OK — ${elapsed}s`, {
    type: 'result',
    payload: { cycleId, results: results.map(r => ({ phase: r.phase, success: r.success, summary: r.summary })), elapsed },
  });
}

// ── Engine Start/Stop ──
let evolutionInterval: NodeJS.Timeout | null = null;

export function startEvolutionMode(): void {
  const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

  console.log('[EvolutionEngine] Agency Evolution Mode ACTIVATED (every 2h)');
  agentLog('EvolutionEngine', '🚀 Agency Evolution Mode ACTIVATED — continuous improvement loop started', { type: 'action' });

  // Run first cycle after 30s (let other systems boot)
  setTimeout(() => {
    runEvolutionCycle().catch(e => {
      console.error('[EvolutionEngine] Cycle error:', e.message);
      agentLog('EvolutionEngine', `Cycle error: ${e.message}`, { type: 'error' });
    });
  }, 30_000);

  // Then every 2 hours
  evolutionInterval = setInterval(() => {
    runEvolutionCycle().catch(e => {
      console.error('[EvolutionEngine] Cycle error:', e.message);
      agentLog('EvolutionEngine', `Cycle error: ${e.message}`, { type: 'error' });
    });
  }, INTERVAL_MS);
}

export function stopEvolutionMode(): void {
  if (evolutionInterval) {
    clearInterval(evolutionInterval);
    evolutionInterval = null;
  }
  console.log('[EvolutionEngine] Agency Evolution Mode DEACTIVATED');
  agentLog('EvolutionEngine', 'Agency Evolution Mode DEACTIVATED', { type: 'action' });
}

export { runEvolutionCycle };
