import cron from 'node-cron';
import prisma from '../config/database';
import { agentLog } from './agent-logger';
import { SocialService } from '../modules/social/social.service';
import { replicateContent, ReplicaFormat } from './content-replicator.agent';

const socialService = new SocialService();

export async function learnFromPerformance(): Promise<{ analyzed: number; saved: number }> {
  await agentLog('Performance Learner', 'Analisando performance dos posts recentes...', { type: 'action' });

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Get published posts from last 48h that haven't been analyzed
  const publishedPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: twoDaysAgo },
      metaPostId: { not: null },
    },
    select: { id: true, metaPostId: true, contentType: true, topic: true, publishedAt: true },
  });

  // Filter out already analyzed
  const existingIds = await prisma.contentPerformance.findMany({
    where: { postId: { in: publishedPosts.map((p) => p.id) } },
    select: { postId: true },
  });
  const analyzedSet = new Set(existingIds.map((e) => e.postId));
  const toAnalyze = publishedPosts.filter((p) => !analyzedSet.has(p.id));

  if (toAnalyze.length === 0) {
    await agentLog('Performance Learner', 'Nenhum post novo para analisar.', { type: 'info' });
    return { analyzed: 0, saved: 0 };
  }

  let saved = 0;
  const scores: number[] = [];

  for (const post of toAnalyze) {
    try {
      // Fetch engagement from Facebook
      let likes = 0, comments = 0, shares = 0;
      try {
        const fbComments = await socialService.getPostComments(post.metaPostId!);
        comments = fbComments.length;
      } catch {
        // API may fail for some posts
      }

      const engagementScore = likes * 1 + comments * 3 + shares * 5;
      const publishedHour = post.publishedAt ? new Date(post.publishedAt).getHours() : null;

      await prisma.contentPerformance.create({
        data: {
          postId: post.id,
          likes,
          comments,
          shares,
          engagementScore,
          contentType: post.contentType,
          topic: post.topic,
          publishedHour,
        },
      });
      saved++;
      scores.push(engagementScore);
    } catch (err: any) {
      await agentLog('Performance Learner', `Erro ao analisar post ${post.id}: ${err.message}`, { type: 'error' });
    }
  }

  // Auto-replication: trigger for posts with engagement > avg+40%
  if (scores.length > 2) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const threshold = avg * 1.4;

    for (let i = 0; i < toAnalyze.length; i++) {
      if (scores[i] !== undefined && scores[i] > threshold && scores[i] > 0) {
        try {
          const alreadyReplicated = await prisma.contentReplica.findFirst({
            where: { originalPostId: toAnalyze[i].id },
          });
          if (!alreadyReplicated) {
            await agentLog('Performance Learner', `Post "${toAnalyze[i].topic}" com score ${scores[i]} (avg: ${avg.toFixed(1)}, threshold: ${threshold.toFixed(1)}) — disparando auto-replicação`, { type: 'action' });
            const formats: ReplicaFormat[] = ['carousel', 'story', 'thread'];
            await replicateContent(toAnalyze[i].id, formats);
          }
        } catch (repErr: any) {
          await agentLog('Performance Learner', `Erro ao auto-replicar post ${toAnalyze[i].id}: ${repErr.message}`, { type: 'error' });
        }
      }
    }
  }

  // Evolve Video Intelligence weights based on new performance data
  try {
    const { evolveVideoWeights } = await import('../services/video-intelligence.service');
    const evolution = await evolveVideoWeights();
    if (evolution.effectsUpdated > 0 || evolution.moodsUpdated > 0) {
      await agentLog('Performance Learner', `Video Intelligence evolved (gen ${evolution.generation}): ${evolution.effectsUpdated} effects, ${evolution.moodsUpdated} moods. Top: ${evolution.topEffect} + ${evolution.topMood}`, { type: 'result' });
    }
  } catch (evolveErr: any) {
    // Non-blocking — video intelligence is optional
    console.error(`[Learner] Video intelligence evolution failed: ${evolveErr.message}`);
  }

  await agentLog('Performance Learner', `Análise concluída: ${toAnalyze.length} posts analisados, ${saved} registros salvos`, {
    type: 'result',
    payload: { analyzed: toAnalyze.length, saved },
  });

  return { analyzed: toAnalyze.length, saved };
}

// Phase 9: Get top performing content types/topics for ROI intelligence
export async function getPerformanceInsights(): Promise<{
  topContentTypes: { contentType: string; avgScore: number }[];
  topHours: { hour: number; avgScore: number }[];
  topTopics: { topic: string; avgScore: number }[];
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const allPerf = await prisma.contentPerformance.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
  });

  // Group by contentType
  const byType = new Map<string, number[]>();
  const byHour = new Map<number, number[]>();
  const byTopic = new Map<string, number[]>();

  for (const p of allPerf) {
    const ct = p.contentType || 'organic';
    if (!byType.has(ct)) byType.set(ct, []);
    byType.get(ct)!.push(p.engagementScore);

    if (p.publishedHour !== null) {
      if (!byHour.has(p.publishedHour)) byHour.set(p.publishedHour, []);
      byHour.get(p.publishedHour)!.push(p.engagementScore);
    }

    if (p.topic) {
      if (!byTopic.has(p.topic)) byTopic.set(p.topic, []);
      byTopic.get(p.topic)!.push(p.engagementScore);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    topContentTypes: Array.from(byType.entries()).map(([contentType, scores]) => ({ contentType, avgScore: avg(scores) })).sort((a, b) => b.avgScore - a.avgScore),
    topHours: Array.from(byHour.entries()).map(([hour, scores]) => ({ hour, avgScore: avg(scores) })).sort((a, b) => b.avgScore - a.avgScore),
    topTopics: Array.from(byTopic.entries()).map(([topic, scores]) => ({ topic, avgScore: avg(scores) })).sort((a, b) => b.avgScore - a.avgScore).slice(0, 10),
  };
}

export function startPerformanceLearner() {
  cron.schedule('0 23 * * *', async () => {
    try {
      await learnFromPerformance();
    } catch (err: any) {
      console.error('[Learner] Erro:', err.message);
      await agentLog('Performance Learner', `Erro: ${err.message}`, { type: 'error' });
    }
  });
  console.log('[Learner] Performance Learner iniciado (diário 23:00)');
}
