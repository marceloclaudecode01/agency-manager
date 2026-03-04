import cron from 'node-cron';
import prisma from '../config/database';
import { askGemini } from './gemini';
import { agentLog } from './agent-logger';
import { isSafeModeActive } from './safe-mode';
import { getBrandContext } from './brand-brain.agent';
import { checkCompliance } from './policy-compliance.agent';
import { checkPatternVariation } from './pattern-variation.agent';

/**
 * Content Governor v2 — GROWTH ACCELERATOR
 *
 * Philosophy: The Governor exists to MAXIMIZE quality output, NOT to limit volume.
 * More high-quality posts = more growth. The only reasons to reject are:
 * 1. Duplicate/repetitive content (hurts page algorithm)
 * 2. Extremely low quality (score < 3, damages brand)
 * 3. Policy violations (gets page banned)
 *
 * Everything else gets APPROVED. We are building billion-dollar level content machines.
 * Each client is independent — their content does not compete with each other.
 */

interface GovernorDecision {
  decision: 'APPROVE' | 'REJECT' | 'RESCHEDULE';
  reason: string;
  qualityScore: number;
  newScheduledFor?: Date;
}

function findNextAvailableSlot(scheduledFor: Date, approvedTimes: Date[]): Date | null {
  const minIntervalMs = 1 * 60 * 60 * 1000; // 1 hour minimum (was 2h — too conservative)
  const sorted = [...approvedTimes].sort((a, b) => a.getTime() - b.getTime());

  const hasConflict = sorted.some(
    (t) => Math.abs(t.getTime() - scheduledFor.getTime()) < minIntervalMs
  );

  if (!hasConflict) return null; // no reschedule needed

  let candidate = new Date(scheduledFor);
  for (const t of sorted) {
    if (Math.abs(candidate.getTime() - t.getTime()) < minIntervalMs) {
      candidate = new Date(t.getTime() + minIntervalMs);
    }
  }

  // Don't schedule past 23:00 (extended from 22:00 — more posting windows)
  if (candidate.getHours() >= 23) return null;

  return candidate;
}

async function evaluatePost(
  post: any,
  approvedTimes: Date[],
  clientId: string | null
): Promise<GovernorDecision> {
  const isVideo = post.contentType === 'video';

  // FAST-TRACK: Videos ALWAYS get approved — video is king for growth
  if (isVideo) {
    let qualityScore = 8;
    try {
      const recentWhere: any = { status: 'PUBLISHED', contentType: 'video' };
      if (clientId) recentWhere.clientId = clientId;
      const recentVideos = await prisma.scheduledPost.findMany({
        where: recentWhere,
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { topic: true },
      });
      const recentTopics = recentVideos.map((p) => p.topic).join(', ');
      const prompt = `Avalie rapidamente este vídeo de 1-10. Só rejeite se for CÓPIA EXATA de um recente.
Vídeo: "${post.message.substring(0, 200)}" | Tópico: "${post.topic}"
Recentes: ${recentTopics || 'nenhum'}
Retorne APENAS JSON: { "score": 8, "isExactDuplicate": false }`;
      const raw = await askGemini(prompt);
      const match = raw.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        qualityScore = Math.max(1, Math.min(10, parsed.score || 8));
        if (parsed.isExactDuplicate && qualityScore < 3) {
          return { decision: 'REJECT', reason: 'Vídeo duplicado exato', qualityScore };
        }
      }
    } catch {}

    return {
      decision: 'APPROVE',
      reason: `Video fast-track approved (qualidade: ${qualityScore}/10)`,
      qualityScore,
    };
  }

  // RESCHEDULE CHECK: 1h minimum interval (per client)
  const newSlot = findNextAvailableSlot(post.scheduledFor, approvedTimes);
  if (newSlot === null && approvedTimes.some(
    (t) => Math.abs(t.getTime() - post.scheduledFor.getTime()) < 1 * 60 * 60 * 1000
  )) {
    // Try to find a slot today — if not possible, reschedule +2h
    const fallbackSlot = new Date(post.scheduledFor.getTime() + 2 * 60 * 60 * 1000);
    if (fallbackSlot.getHours() < 23) {
      return {
        decision: 'RESCHEDULE',
        reason: `Reagendado para ${fallbackSlot.toTimeString().slice(0, 5)} (intervalo 1h)`,
        qualityScore: 7,
        newScheduledFor: fallbackSlot,
      };
    }
    // Schedule for tomorrow same time
    const tomorrow = new Date(post.scheduledFor);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      decision: 'RESCHEDULE',
      reason: `Reagendado para amanhã ${tomorrow.toTimeString().slice(0, 5)} (sem slot hoje)`,
      qualityScore: 7,
      newScheduledFor: tomorrow,
    };
  }

  // QUALITY + DUPLICATE CHECK via LLM (the only real filter)
  let qualityScore = 7;
  try {
    const recentWhere: any = { status: 'PUBLISHED' };
    if (clientId) recentWhere.clientId = clientId;
    const recentPosts = await prisma.scheduledPost.findMany({
      where: recentWhere,
      orderBy: { publishedAt: 'desc' },
      take: 50,
      select: { topic: true, message: true },
    });

    const recentTopics = recentPosts.map((p) => p.topic).join(', ');
    const brandContext = await getBrandContext();

    const prompt = `Avalie este post para redes sociais de 1 a 10 (qualidade, originalidade, potencial de engajamento).
${brandContext}
Post: "${post.message.substring(0, 300)}"
Tópico: "${post.topic}"
Tópicos recentes publicados (últimos 50): ${recentTopics || 'nenhum'}

REGRA: Marque isDuplicate=true APENAS se o tópico for QUASE IDÊNTICO a um dos 50 recentes.
Variações do mesmo tema geral com ângulos DIFERENTES são PERMITIDAS e devem ser aprovadas.
Nosso objetivo é CRESCIMENTO MÁXIMO — aprove conteúdo bom com generosidade.
Retorne APENAS JSON: { "score": 7, "isDuplicate": false, "reason": "motivo breve" }`;

    const raw = await askGemini(prompt);
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      qualityScore = Math.max(1, Math.min(10, parsed.score || 7));

      // Only reject TRUE duplicates with low quality
      if (parsed.isDuplicate && qualityScore < 4) {
        return {
          decision: 'REJECT',
          reason: `Conteúdo duplicado: ${parsed.reason}`,
          qualityScore,
        };
      }

      // Only reject EXTREMELY low quality
      if (qualityScore < 3) {
        return {
          decision: 'REJECT',
          reason: `Qualidade muito baixa (${qualityScore}/10): ${parsed.reason}`,
          qualityScore,
        };
      }
    }
  } catch (err: any) {
    console.log(`[Governor] LLM check falhou, aprovando com score padrão: ${err.message}`);
  }

  // COMPLIANCE CHECK — only block HIGH risk (platform ban risk)
  try {
    const compliance = await checkCompliance(post.message, post.platform || 'facebook');
    if (!compliance.compliant && compliance.riskLevel === 'HIGH') {
      return {
        decision: 'REJECT',
        reason: `compliance: ${compliance.issues.join('; ')}`,
        qualityScore,
      };
    }
  } catch {}

  // PATTERN VARIATION — just adjust score, never reject
  try {
    const variation = await checkPatternVariation(post.message);
    if (!variation.varied && variation.similarityScore >= 80) {
      qualityScore = Math.max(1, qualityScore - 1);
    }
  } catch {}

  // ALL CHECKS PASSED → APPROVE (with possible time adjustment)
  if (newSlot) {
    return {
      decision: 'APPROVE',
      reason: `Aprovado e reagendado de ${post.scheduledFor.toTimeString().slice(0, 5)} para ${newSlot.toTimeString().slice(0, 5)} (intervalo 1h)`,
      qualityScore,
      newScheduledFor: newSlot,
    };
  }

  return {
    decision: 'APPROVE',
    reason: `Aprovado (qualidade: ${qualityScore}/10) — crescimento máximo`,
    qualityScore,
  };
}

export async function reviewPendingPosts(): Promise<void> {
  const safeMode = await isSafeModeActive();
  if (safeMode) {
    await agentLog('Content Governor', 'Safe mode ativo — apenas vídeos serão revisados', { type: 'info' });
  }

  // Anti-spam — cooldown only if 5+ FAILED in last 15min (was 3 — too aggressive)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentFailedCount = await prisma.scheduledPost.count({
    where: { status: 'FAILED', updatedAt: { gte: fifteenMinAgo } },
  });
  if (recentFailedCount >= 5) {
    await agentLog('Content Governor', `Cooldown ativo (${recentFailedCount} posts FAILED nos últimos 15min). Revisão adiada.`, { type: 'info' });
    return;
  }

  // Fetch ALL pending posts not yet reviewed
  const pendingWhere: any = { status: 'PENDING', governorDecision: null };
  if (safeMode) {
    pendingWhere.contentType = 'video';
  }
  const pending = await prisma.scheduledPost.findMany({
    where: pendingWhere,
    orderBy: { scheduledFor: 'asc' },
  });

  if (pending.length === 0) return;

  // Group posts by clientId for independent processing
  const postsByClient = new Map<string, typeof pending>();
  for (const post of pending) {
    const key = post.clientId || '__default__';
    if (!postsByClient.has(key)) postsByClient.set(key, []);
    postsByClient.get(key)!.push(post);
  }

  await agentLog('Content Governor', `Revisando ${pending.length} posts pendentes para ${postsByClient.size} client(s)`, {
    type: 'action',
    payload: { pending: pending.length, clients: postsByClient.size },
  });

  let totalApproved = 0;
  let totalRejected = 0;

  // Process each client independently
  for (const [clientKey, clientPosts] of postsByClient) {
    const clientId = clientKey === '__default__' ? null : clientKey;
    const clientLabel = clientId ? `(client: ${clientId})` : '(default)';

    // Get today's already approved times for THIS client (for interval check)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayApprovedWhere: any = {
      scheduledFor: { gte: today, lte: todayEnd },
      OR: [
        { governorDecision: 'APPROVE' },
        { status: 'PUBLISHED' },
      ],
    };
    if (clientId) todayApprovedWhere.clientId = clientId;

    const todayApproved = await prisma.scheduledPost.findMany({
      where: todayApprovedWhere,
      select: { scheduledFor: true },
    });

    let approvedTimes = todayApproved.map((p) => p.scheduledFor);

    // Review each post for this client
    for (const post of clientPosts) {
      const decision = await evaluatePost(post, approvedTimes, clientId);

      const updateData: any = {
        governorDecision: decision.decision,
        governorReason: decision.reason,
        governorReviewedAt: new Date(),
        qualityScore: decision.qualityScore,
      };

      if (decision.decision === 'APPROVE') {
        updateData.status = 'APPROVED';
        // Anti-spam humanization — ±10min random offset
        const baseTime = decision.newScheduledFor || post.scheduledFor;
        const offsetMs = (Math.random() * 20 - 10) * 60 * 1000; // -10 to +10 min
        const humanizedTime = new Date(baseTime.getTime() + offsetMs);
        updateData.scheduledFor = humanizedTime;
        approvedTimes.push(humanizedTime);
        totalApproved++;
      } else if (decision.decision === 'REJECT') {
        updateData.status = 'REJECTED';
        totalRejected++;
      } else if (decision.decision === 'RESCHEDULE') {
        updateData.status = 'APPROVED';
        updateData.scheduledFor = decision.newScheduledFor;
        if (decision.newScheduledFor) approvedTimes.push(decision.newScheduledFor);
        totalApproved++;
      }

      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: updateData,
      });

      await agentLog('Content Governor', `${decision.decision} ${clientLabel}: "${post.topic}" — ${decision.reason}`, {
        type: 'result',
        payload: {
          postId: post.id,
          decision: decision.decision,
          qualityScore: decision.qualityScore,
          source: post.source,
          contentType: post.contentType,
          clientId,
        },
      });
    }
  }

  await agentLog('Content Governor', `Revisão concluída: ${totalApproved} aprovados, ${totalRejected} rejeitados de ${pending.length} pendentes`, {
    type: 'info',
    payload: { totalApproved, totalRejected, total: pending.length },
  });
}

export function startContentGovernor() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      await reviewPendingPosts();
    } catch (err: any) {
      console.error('[Governor] Erro:', err.message);
      await agentLog('Content Governor', `Erro: ${err.message}`, { type: 'error' });
    }
  });
  console.log('[Governor] Content Governor v2 (Growth Accelerator) iniciado (a cada 10 minutos)');
}
