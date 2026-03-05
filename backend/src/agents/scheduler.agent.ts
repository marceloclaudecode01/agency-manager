import cron from 'node-cron';
import prisma from '../config/database';
import { SocialService, PageCredentials } from '../modules/social/social.service';
import { generateCommentReply, CommentClientContext, sortByPriority } from './comment-responder.agent';
import { analyzeMetrics } from './metrics-analyzer.agent';
import { generateImageForPost } from './image-generator.agent';
import { notificationsService } from '../modules/notifications/notifications.service';
import { buildDailyStrategy, ClientContext } from './content-strategist.agent';
import { generatePostFromStrategy } from './content-creator.agent';
import { analyzeTrendingTopics } from './trending-topics.agent';
import { orchestrateProductPosts } from './product-orchestrator.agent';
import { runTokenMonitor } from './token-monitor.agent';
import { agentLog } from './agent-logger';
import { trackAgentExecution } from './agent-performance-tracker';
import { startContentGovernor } from './content-governor.agent';
import { startGrowthDirector } from './growth-director.agent';
import { startSystemSentinel } from './system-sentinel.agent';
import { startPerformanceLearner } from './performance-learner.agent';
import { isSafeModeActive } from './safe-mode';
import { seedBrandConfig } from './brand-brain.agent';
import { enhanceWithViralMechanics } from './viral-mechanics.agent';
import { createABVariant, startABTestingEngine } from './ab-testing-engine.agent';
import { startReputationMonitor } from './reputation-monitor.agent';
import { startLeadCaptureAgent } from './lead-capture.agent';
import { startStrategicCommandAgent } from './strategic-command.agent';
import { startNicheLearningAgent } from './niche-learning.agent';
import { startStrategicEngine } from './strategic-engine.agent';
import { startEvolutionEngine } from './evolution-engine.agent';
import { startShortVideoEngine } from './short-video-engine.agent';
import { startGrowthAnalyst } from './growth-analyst.agent';
import { generateCarouselFromStructure, shouldGenerateCarousel } from './carousel-generator.agent';
import { optimizeForPlatform } from './platform-optimizer.agent';
import { queueVideoForPost, startVideoProcessor } from './video-generator.agent';
// Video generation is always available (cloud providers + local ffmpeg fallback)

// Default social service (env vars) — used for backward compat
const socialService = new SocialService();

// Helper: get SocialService for a specific post (client-aware)
async function getSocialServiceForPost(post: { clientId?: string | null }): Promise<SocialService> {
  if (post.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: post.clientId },
      select: { facebookPageId: true, facebookAccessToken: true, name: true },
    });
    if (client?.facebookPageId && client?.facebookAccessToken) {
      return new SocialService({
        pageId: client.facebookPageId,
        accessToken: client.facebookAccessToken,
      });
    }
  }
  // Fallback to default (env vars)
  return socialService;
}

// Limits increased for video-first strategy: 10 posts/day, 1h interval
const MAX_POSTS_PER_DAY = 10;
const MIN_INTERVAL_HOURS = 1;

async function getPostsPublishedToday(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.scheduledPost.count({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: today },
    },
  });
  return count;
}

async function getLastPublishedAt(): Promise<Date | null> {
  const last = await prisma.scheduledPost.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
  });
  return last?.publishedAt || null;
}

// Check if current time is within ideal posting window (±30min of bestPostingHours)
async function isInIdealPostingWindow(): Promise<{ inWindow: boolean; nextWindowMinutes: number }> {
  try {
    const growthConfig = await prisma.systemConfig.findUnique({ where: { key: 'growth_insights' } });
    if (!growthConfig?.value) return { inWindow: true, nextWindowMinutes: 0 }; // No data = always publish

    const gi = growthConfig.value as any;
    const bestHours = gi.bestPostingHours as string[] | undefined;
    if (!bestHours || bestHours.length === 0) return { inWindow: true, nextWindowMinutes: 0 };

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const windowSize = 30; // ±30 minutes

    for (const timeStr of bestHours) {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h)) continue;
      const targetMinutes = h * 60 + (m || 0);
      if (Math.abs(nowMinutes - targetMinutes) <= windowSize) {
        return { inWindow: true, nextWindowMinutes: 0 };
      }
    }

    // Find next window
    const sorted = bestHours.map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); }).sort((a, b) => a - b);
    let nextWindow = 0;
    for (const target of sorted) {
      if (target - windowSize > nowMinutes) {
        nextWindow = target - windowSize - nowMinutes;
        break;
      }
    }

    return { inWindow: false, nextWindowMinutes: nextWindow };
  } catch {
    return { inWindow: true, nextWindowMinutes: 0 }; // On error, allow publishing
  }
}

// Roda a cada 5 minutos: verifica posts agendados para publicar
export function startPostScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    await trackAgentExecution('post-scheduler', async () => {
    let pendingPosts: Awaited<ReturnType<typeof prisma.scheduledPost.findMany>> = [];
    try {
      const now = new Date();

      // Check safe mode — but still allow video posts through
      const safeMode = await isSafeModeActive();

      const approvedWhere = {
        status: 'APPROVED' as const,
        scheduledFor: { lte: now },
        OR: [
          { governorDecision: 'APPROVE' },
          { governorDecision: null, source: null }, // backward compat: manual posts
        ],
      };

      // Videos get priority — fetch video first, then fallback to any post
      const videoPosts = await prisma.scheduledPost.findMany({
        where: { ...approvedWhere, contentType: 'video' },
        orderBy: { scheduledFor: 'asc' },
        take: 1,
      });

      pendingPosts = videoPosts.length > 0
        ? videoPosts
        : await prisma.scheduledPost.findMany({
            where: approvedWhere,
            orderBy: { scheduledFor: 'asc' },
            take: 1,
          });

      if (pendingPosts.length === 0) return;

      const post = pendingPosts[0];
      const isVideoPost = post?.contentType === 'video';

      // Safe mode blocks non-video posts; videos always go through
      if (safeMode && !isVideoPost) {
        return;
      }

      const postsToday = await getPostsPublishedToday();

      // Videos bypass daily limit — they always publish
      if (!isVideoPost && postsToday >= MAX_POSTS_PER_DAY) {
        await agentLog('Scheduler', `Limite diário atingido (${MAX_POSTS_PER_DAY} posts). Aguardando amanhã.`, { type: 'info' });
        return;
      }

      const lastPublished = await getLastPublishedAt();
      // Videos use 30min interval, others use MIN_INTERVAL_HOURS
      const effectiveInterval = isVideoPost ? 0.5 : MIN_INTERVAL_HOURS;
      if (lastPublished) {
        const hoursSinceLast = (now.getTime() - lastPublished.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < effectiveInterval) {
          // Silent — only console log, avoid DB spam every 5min
          console.log(`[Scheduler] Intervalo mínimo: próximo post em ${(effectiveInterval - hoursSinceLast).toFixed(1)}h`);
          return;
        }
      }

      // Ideal posting window check — only delay if post is not overdue by >1h
      if (!isVideoPost) {
        const postAge = now.getTime() - post.scheduledFor.getTime();
        const oneHourMs = 60 * 60 * 1000;
        if (postAge < oneHourMs) { // Post is not overdue by >1h
          const windowCheck = await isInIdealPostingWindow();
          if (!windowCheck.inWindow && windowCheck.nextWindowMinutes > 0) {
            console.log(`[Scheduler] Aguardando janela ideal (próxima em ${windowCheck.nextWindowMinutes}min)`);
            return;
          }
        }
      }

      // Skip natively scheduled posts (Meta handles them)
      if ((post as any).nativeScheduled) {
        return;
      }

      await agentLog('Scheduler', `Post encontrado para publicação: "${post.topic || post.message.substring(0, 50)}"${post.clientId ? ` (client: ${post.clientId})` : ''}`, { type: 'action', to: 'Facebook API' });

      const fullMessage = post.hashtags ? `${post.message}\n\n${post.hashtags}` : post.message;

      // Get client-specific SocialService (or default)
      const postSocialService = await getSocialServiceForPost(post);

      let publishResult: any;

      // Publish: video if videoUrl, image if imageUrl, text-only otherwise
      if (post.contentType === 'video' && post.videoUrl) {
        publishResult = await postSocialService.publishVideoPost(fullMessage, post.videoUrl);
      } else if (post.imageUrl) {
        publishResult = await postSocialService.publishMediaPost(fullMessage, post.imageUrl, { mediaType: 'image' });
      } else {
        publishResult = await postSocialService.publishPost(fullMessage);
      }

      const fbPostId = publishResult?.id || null;

      await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: 'PUBLISHED', publishedAt: now } });

      if (fbPostId) {
        await prisma.productCampaign.updateMany({ where: { scheduledPostId: post.id }, data: { status: 'PUBLISHED', fbPostId } });
      }

      await agentLog('Scheduler', `✅ Post publicado no Facebook com sucesso! ID: ${fbPostId || 'N/A'}`, { type: 'result', payload: { topic: post.topic, fbPostId } });

      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await notificationsService.createAndEmit(admin.id, 'TASK_ASSIGNED', 'Post publicado!', `"${post.topic || post.message.substring(0, 50)}" foi publicado no Facebook`);
      }
    } catch (err: any) {
      const isPermissionError = err.response?.status === 403 ||
        (err.message && (err.message.includes('pages_manage_posts') || err.message.includes('pages_read_engagement') || err.message.includes('#200')));

      if (isPermissionError) {
        console.error('[Scheduler] ⚠️ Token sem permissão pages_manage_posts. Configure um Page Access Token com as permissões corretas no Facebook Developer.');
        const failedPost = pendingPosts[0];
        await agentLog('Scheduler', `⚠️ Token sem permissão de publicação. Post "${failedPost?.topic || failedPost?.id || 'unknown'}" marcado como FAILED. Atualize o token no Railway.`, { type: 'error' });
        // Mark only THIS post as FAILED (not all APPROVED posts)
        try {
          if (failedPost) {
            await prisma.scheduledPost.update({
              where: { id: failedPost.id },
              data: { status: 'FAILED' },
            });
          }
        } catch {}
        // Throttled admin alert: max 1x per hour
        try {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const recentAlert = await prisma.notification.findFirst({
            where: { title: 'Erro de permissão Facebook', createdAt: { gte: oneHourAgo } },
          });
          if (!recentAlert) {
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
            for (const admin of admins) {
              await notificationsService.createAndEmit(admin.id, 'TASK_ASSIGNED', 'Erro de permissão Facebook', 'Token sem permissão pages_manage_posts. Atualize o token no Railway.');
            }
          }
        } catch {}
        return;
      }

      console.error('[Scheduler] Erro ao publicar post:', err.message);
      // Retry logic: 3 attempts with 30min backoff
      const currentPost = pendingPosts[0];
      if (currentPost) {
        const currentRetry = (currentPost as any).retryCount ?? 0;
        if (currentRetry < 3) {
          const nextAttempt = new Date(Date.now() + 30 * 60 * 1000); // +30min
          await agentLog('Scheduler', `⚠️ Erro ao publicar post (tentativa ${currentRetry + 1}/3): ${err.message}. Reagendando para ${nextAttempt.toTimeString().slice(0, 5)}`, { type: 'info' });
          try {
            await prisma.scheduledPost.update({
              where: { id: currentPost.id },
              data: { retryCount: currentRetry + 1, scheduledFor: nextAttempt },
            });
          } catch {}
        } else {
          await agentLog('Scheduler', `❌ Post falhou após 3 tentativas: ${err.message}`, { type: 'error' });
          try {
            await prisma.scheduledPost.update({ where: { id: currentPost.id }, data: { status: 'FAILED' } });
          } catch {}
        }
      }
    }
    }); // trackAgentExecution
  });

  console.log('[Scheduler] Post scheduler iniciado (verificação a cada 5 minutos + janelas ideais)');
}

// Palavras-chave que indicam interesse em comprar
const BUY_INTENT_KEYWORDS = [
  'quanto', 'preço', 'valor', 'custa', 'link', 'onde', 'compro', 'comprar',
  'quero', 'quero esse', 'quero essa', 'me manda', 'manda o link', 'como compro',
  'como faço', 'disponivel', 'disponível', 'vende', 'tem', 'aceita', 'parcela',
  'interessei', 'interessada', 'interessado', 'adorei', 'amei', 'preciso',
];

function hasBuyIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return BUY_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

// Extract signup/cadastro link from client niche field
function extractSignupLink(niche?: string | null): string | undefined {
  if (!niche) return undefined;
  const match = niche.match(/https?:\/\/federalassociados\.com\.br\S*/i);
  return match ? match[0] : undefined;
}

// Process comments for a single page (client or default)
async function processCommentsForPage(
  pageSocialService: SocialService,
  clientLabel: string,
  commentCtx?: CommentClientContext
): Promise<number> {
  let posts: any[] = [];
  try {
    posts = await pageSocialService.getPosts(10);
  } catch (fetchErr: any) {
    await agentLog('Comment Responder', `${clientLabel} ⚠️ Não foi possível buscar posts: ${fetchErr.message}`, { type: 'info' });
    return 0;
  }
  if (posts.length === 0) return 0;

  const productCampaigns = await prisma.productCampaign.findMany({
    where: { status: 'PUBLISHED', autoReply: true, replyTemplate: { not: null } },
  });

  let repliedCount = 0;

  for (const post of posts) {
    let comments: any[] = [];
    try {
      comments = await pageSocialService.getPostComments(post.id);
    } catch (commentErr: any) {
      const msg = commentErr.response?.data?.error?.message || commentErr.message;
      if (msg.includes('pages_read_engagement') || msg.includes('Page Public Content Access')) {
        await agentLog('Comment Responder', `${clientLabel} ⚠️ Facebook App em modo Development — comments desabilitados.`, { type: 'info' });
        return repliedCount;
      }
      continue;
    }
    const campaign = productCampaigns.find(
      (c) => c.fbPostId === post.id || (post.message && c.generatedCopy && post.message.includes(c.generatedCopy.substring(0, 50)))
    );

    // Sort by priority: BUY_INTENT → DOUBT → COMMON → CRITICISM
    const sortedComments = sortByPriority(comments);

    for (const comment of sortedComments) {
      const alreadyReplied = await prisma.commentLog.findFirst({ where: { commentId: comment.id } });
      if (alreadyReplied) continue;

      let reply = '';

      if (campaign?.replyTemplate && hasBuyIntent(comment.message)) {
        const commenterName = comment.from?.name?.split(' ')[0] || 'você';
        reply = campaign.replyTemplate.replace('[NOME]', commenterName);
        await agentLog('Comment Responder', `${clientLabel} 💬 Intenção de compra detectada de "${comment.from?.name || 'usuário'}".`, { type: 'communication', to: 'Copywriter' });
      } else {
        await agentLog('Comment Responder', `${clientLabel} Gerando resposta para: "${comment.message.substring(0, 60)}"`, { type: 'communication', to: 'Gemini AI' });
        reply = await generateCommentReply(comment.message, post.message || post.story, commentCtx);
      }

      // Sentiment analysis before replying
      let sentiment: string | null = null;
      try {
        const { askGemini: askGeminiSentiment } = await import('./gemini');
        const sentimentRaw = await askGeminiSentiment(`Classifique o sentimento deste comentário em uma palavra: POSITIVE, NEUTRAL, NEGATIVE ou CRISIS.
Comentário: "${comment.message.substring(0, 200)}"
Retorne APENAS a classificação.`);
        const cleaned = sentimentRaw.trim().toUpperCase();
        if (['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'CRISIS'].includes(cleaned)) {
          sentiment = cleaned;
        }
      } catch {}

      // CRISIS — don't auto-reply, alert admin
      if (sentiment === 'CRISIS') {
        await prisma.commentLog.create({ data: { commentId: comment.id, action: 'CRISIS_HOLD', reply: '', sentiment } });
        await agentLog('Comment Responder', `${clientLabel} 🚨 CRISE detectada: "${comment.message.substring(0, 60)}" — admin notificado`, { type: 'error' });
        const crisisAdmins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of crisisAdmins) {
          await notificationsService.createAndEmit(admin.id, 'TASK_ASSIGNED', 'CRISE: Comentário negativo', `${clientLabel} "${comment.message.substring(0, 100)}". Responda manualmente.`);
        }
        continue;
      }

      if (!reply) {
        await prisma.commentLog.create({ data: { commentId: comment.id, action: 'IGNORED', reply: '', sentiment } });
        continue;
      }

      try {
        await pageSocialService.replyToComment(comment.id, reply);
      } catch (replyErr: any) {
        await agentLog('Comment Responder', `${clientLabel} ⚠️ Falha ao responder: ${replyErr.message}`, { type: 'info' });
        await prisma.commentLog.create({ data: { commentId: comment.id, action: 'FAILED', reply, sentiment } });
        continue;
      }
      await prisma.commentLog.create({ data: { commentId: comment.id, action: 'REPLIED', reply, sentiment } });
      repliedCount++;

      await agentLog('Comment Responder', `${clientLabel} ✅ Respondido: "${comment.message.substring(0, 40)}" → "${reply.substring(0, 40)}"`, { type: 'result' });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  return repliedCount;
}

// Roda a cada 30 minutos: verifica e responde comentários novos — MULTI-PAGE
export function startCommentResponder() {
  cron.schedule('*/30 * * * *', async () => {
    await trackAgentExecution('comment-responder', async () => {
    try {
      await agentLog('Comment Responder', 'Verificando comentários novos (multi-page)...', { type: 'action', to: 'Facebook API' });

      // Load active clients with Facebook page config
      const activeClients = await prisma.client.findMany({
        where: { isActive: true, status: 'ACTIVE' },
        select: { id: true, name: true, niche: true, notes: true, facebookPageId: true, facebookAccessToken: true, facebookPageName: true },
      });

      let totalReplied = 0;

      if (activeClients.length === 0) {
        // No clients — use default page
        totalReplied = await processCommentsForPage(socialService, '[Default]');
      } else {
        for (const client of activeClients) {
          try {
            // Build SocialService for this client
            let clientSocial: SocialService;
            if (client.facebookPageId && client.facebookAccessToken) {
              clientSocial = new SocialService({ pageId: client.facebookPageId, accessToken: client.facebookAccessToken });
            } else {
              clientSocial = socialService; // fallback to env vars
            }

            // Build comment context with signup link for Federal
            const signupLink = extractSignupLink(client.niche);
            const commentCtx: CommentClientContext = {
              pageName: client.facebookPageName || client.name,
              niche: client.niche || undefined,
              notes: client.notes || undefined,
              signupLink,
            };

            const replied = await processCommentsForPage(clientSocial, `[${client.name}]`, commentCtx);
            totalReplied += replied;
          } catch (clientErr: any) {
            await agentLog('Comment Responder', `[${client.name}] ❌ Erro: ${clientErr.message}`, { type: 'error' });
          }
        }
      }

      if (totalReplied === 0) {
        await agentLog('Comment Responder', 'Nenhum comentário novo para responder.', { type: 'info' });
      } else {
        await agentLog('Comment Responder', `✅ ${totalReplied} comentários respondidos no total.`, { type: 'result' });
      }
    } catch (err: any) {
      console.error('[Comments] Erro:', err.message);
      await agentLog('Comment Responder', `❌ Erro: ${err.message}`, { type: 'error' });
    }
    }); // trackAgentExecution
  });

  console.log('[Comments] Comment responder MULTI-PAGE iniciado (verificação a cada 30 minutos)');
}

// Roda todo dia às 8h: análise de métricas
export function startMetricsAnalyzer() {
  cron.schedule('0 8 * * *', async () => {
    await trackAgentExecution('metrics-collector', async () => {
    try {
      await agentLog('Metrics Analyzer', 'Coletando dados da página no Facebook...', { type: 'action', to: 'Facebook API' });
      const pageInfo = await socialService.getPageInfo();
      const insights = await socialService.getPageInsights('week');
      const posts = await socialService.getPosts(7);

      await agentLog('Metrics Analyzer', `Dados coletados: ${pageInfo.followers_count || 0} seguidores. Enviando para análise...`, { type: 'communication', to: 'Gemini AI', payload: { followers: pageInfo.followers_count } });

      const report = await analyzeMetrics({
        followers: pageInfo.followers_count || 0,
        followersPrev: (pageInfo.followers_count || 0) - (insights.page_fan_adds?.value || 0),
        reach: insights.page_impressions_unique?.value || 0,
        engagement: insights.page_engaged_users?.value || 0,
        posts,
      });

      await prisma.metricsReport.create({
        data: {
          summary: report.summary,
          highlights: report.highlights,
          recommendations: report.recommendations,
          bestPostingTimes: report.bestPostingTimes,
          growthScore: report.growthScore,
          engagementScore: report.engagementScore || null,
          commercialScore: report.commercialScore || null,
          riskScore: report.riskScore || null,
          rawData: { pageInfo, insights },
        },
      });

      await agentLog('Metrics Analyzer', `📊 Relatório gerado. Score de crescimento: ${report.growthScore}/10. Enviando insights para Content Strategist...`, { type: 'result', to: 'Content Strategist', payload: { growthScore: report.growthScore, summary: report.summary } });
    } catch (err: any) {
      console.error('[Metrics] Erro:', err.message);
      await agentLog('Metrics Analyzer', `❌ Erro ao analisar métricas: ${err.message}`, { type: 'error' });
    }
    }); // trackAgentExecution
  });

  console.log('[Metrics] Metrics analyzer iniciado (roda todo dia às 08:00)');
}

function startDueDateNotifier() {
  cron.schedule('0 8 * * *', async () => {
    await trackAgentExecution('deadline-notifier', async () => {
    try {
      const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const tasks = await prisma.task.findMany({
        where: {
          dueDate: { lte: twoDaysFromNow, gte: new Date() },
          status: { not: 'DONE' },
          assigneeId: { not: null },
        },
      });

      for (const task of tasks) {
        await notificationsService.createAndEmit(
          task.assigneeId!,
          'TASK_DUE',
          'Prazo próximo',
          `A tarefa "${task.title}" vence em breve!`,
          task.id
        );
      }

      if (tasks.length > 0) {
        console.log(`[DueDate] ${tasks.length} notificação(ões) de prazo enviadas`);
      }
    } catch (err: any) {
      console.error('[DueDate] Erro:', err.message);
    }
    }); // trackAgentExecution
  });

  console.log('[DueDate] Verificador de prazos iniciado (roda todo dia às 08:00)');
}

// Generate posts for a single client (or default page if no client)
async function generatePostsForClient(clientCtx?: { clientId: string; clientName: string; niche: string; facebookPageName?: string; notes?: string }): Promise<string[]> {
  const label = clientCtx ? `[${clientCtx.clientName}]` : '[Default]';

  await agentLog('Autonomous Engine', `${label} Solicitando estratégia diária ao Content Strategist...`, { type: 'communication', to: 'Content Strategist' });
  const strategy = await buildDailyStrategy(clientCtx ? {
    clientId: clientCtx.clientId,
    clientName: clientCtx.clientName,
    niche: clientCtx.niche,
    facebookPageName: clientCtx.facebookPageName,
    notes: clientCtx.notes,
  } : undefined);

  await agentLog('Content Strategist', `${label} Estratégia pronta: ${strategy.postsToCreate} posts — ${strategy.reasoning}`, { type: 'result', to: 'Autonomous Engine', payload: { postsToCreate: strategy.postsToCreate, topics: strategy.topics } });

  // Get recent topics for THIS client (anti-duplication per client) — expanded window
  const recentWhere: any = { status: 'PUBLISHED' };
  if (clientCtx) recentWhere.clientId = clientCtx.clientId;
  const recentPosts = await prisma.scheduledPost.findMany({
    where: recentWhere,
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: { topic: true },
  });
  const recentTopics = recentPosts.map((p) => p.topic).filter(Boolean) as string[];

  const today = new Date();
  const scheduledIds: string[] = [];

  for (let i = 0; i < strategy.postsToCreate; i++) {
    try {
      const topic = strategy.topics[i];
      const focusType = strategy.focusType[i] || 'entretenimento';
      const timeStr = strategy.scheduledTimes[i] || '18:00';

      await agentLog('Autonomous Engine', `${label} Solicitando post sobre "${topic}" ao Content Creator...`, { type: 'communication', to: 'Content Creator' });
      const generated = await generatePostFromStrategy(topic, focusType, recentTopics, clientCtx?.niche, clientCtx?.notes);
      await agentLog('Content Creator', `${label} Post criado: "${generated.message.substring(0, 60)}..."`, { type: 'result', to: 'Autonomous Engine' });

      // Viral Mechanics Lab: enhance post before scheduling
      let viralScore: number | null = null;
      let viralEnhancements: any = null;
      try {
        await agentLog('Autonomous Engine', `${label} Aplicando Viral Mechanics em "${topic}"...`, { type: 'communication', to: 'Viral Mechanics' });
        const enhanced = await enhanceWithViralMechanics(generated.message, topic, focusType);
        // Always apply viral mechanics — all 5 layers are mandatory
        generated.message = enhanced.enhancedMessage;
        viralScore = enhanced.viralScore;
        viralEnhancements = {
          techniques: enhanced.appliedTechniques,
          hookType: enhanced.hookType,
          emotionalTrigger: enhanced.emotionalTrigger,
        };
        await agentLog('Viral Mechanics', `${label} Post enhanced: score ${enhanced.viralScore}/10, hook: ${enhanced.hookType}`, { type: 'result', to: 'Autonomous Engine' });
      } catch (viralErr: any) {
        await agentLog('Viral Mechanics', `${label} ⚠️ Enhancement falhou: ${viralErr.message}`, { type: 'error' });
      }

      // Platform Optimizer: adjust post for Facebook rules
      try {
        const optimized = optimizeForPlatform(generated.message, generated.hashtags || [], 'facebook');
        generated.message = optimized.message;
        generated.hashtags = optimized.hashtags;
        if (optimized.adjustments.length > 0 && optimized.adjustments[0] !== 'Nenhum ajuste necessário') {
          await agentLog('Platform Optimizer', `${label} Ajustes: ${optimized.adjustments.join(', ')}`, { type: 'info' });
        }
      } catch (optErr: any) {
        await agentLog('Platform Optimizer', `${label} ⚠️ Falha: ${optErr.message}`, { type: 'error' });
      }

      // Carousel Generator: auto-generate carousel for autoridade/educativo posts
      let carouselData: any = null;
      if (generated.structure && shouldGenerateCarousel(generated.contentCategory, generated.structure)) {
        try {
          carouselData = generateCarouselFromStructure(generated.structure, topic);
          await agentLog('Carousel Generator', `${label} Carrossel gerado: ${carouselData.slideCount} slides para "${topic}"`, { type: 'result' });
        } catch (carErr: any) {
          await agentLog('Carousel Generator', `${label} ⚠️ Falha: ${carErr.message}`, { type: 'error' });
        }
      }

      // Generate UNIQUE AI image for every post (Pollinations.ai + Gemini prompt)
      let imageUrl: string | null = null;
      try {
        await agentLog('Autonomous Engine', `${label} Gerando imagem AI única para "${topic}"...`, { type: 'communication', to: 'Image Generator' });
        const image = await generateImageForPost(topic, focusType, generated.message, clientCtx?.clientId);
        imageUrl = image.url || null;
        await agentLog('Image Generator', `${label} Imagem AI única gerada (${image.source}) para "${topic}"`, { type: 'result', to: 'Autonomous Engine' });
      } catch (imgErr: any) {
        await agentLog('Image Generator', `${label} ⚠️ Falha ao gerar imagem: ${imgErr.message}. Post será publicado sem imagem.`, { type: 'error' });
      }

      const [hours, minutes] = timeStr.split(':').map(Number);
      const scheduledFor = new Date(today);
      scheduledFor.setHours(hours, minutes, 0, 0);

      const hashtagsStr = generated.hashtags
        ? generated.hashtags.map((h: string) => `#${h.replace('#', '')}`).join(' ')
        : null;

      // 50% of posts are video (every other post) — video-first strategy
      // Video is ALWAYS available now: cloud providers OR local ffmpeg from AI images
      const isVideo = i % 2 === 1;
      const postContentType = isVideo ? 'video' : 'organic';
      const postStatus = isVideo ? 'PENDING_VIDEO' as const : 'PENDING' as const;

      const saved = await prisma.scheduledPost.create({
        data: {
          topic: generated.topic || topic,
          message: generated.message,
          hashtags: hashtagsStr,
          imageUrl,
          status: postStatus,
          source: 'autonomous-engine',
          contentType: postContentType,
          scheduledFor,
          viralScore,
          viralEnhancements,
          ...(carouselData ? { carouselData } : {}),
          ...(clientCtx ? { clientId: clientCtx.clientId } : {}),
        },
      });

      // Fire-and-forget: queue video generation for PENDING_VIDEO posts
      if (postStatus === 'PENDING_VIDEO') {
        queueVideoForPost(saved.id).catch((err: any) => {
          console.error(`[Engine] Failed to queue video for post ${saved.id}: ${err.message}`);
        });
      }

      scheduledIds.push(saved.id);
      recentTopics.push(topic);
      await agentLog('Autonomous Engine', `${label} 📅 Post ${i + 1}/${strategy.postsToCreate} agendado: "${topic}" para as ${timeStr}`, { type: 'action', to: 'Scheduler' });

      // A/B Testing: create variant B for non-video posts
      if (postContentType !== 'video') {
        try {
          let abEnabled = false;
          try {
            const aggConfig = await prisma.systemConfig.findUnique({ where: { key: 'aggressive_growth_mode' } });
            const isAggressive = aggConfig?.value === true || (aggConfig?.value as any)?.enabled === true;
            abEnabled = isAggressive || Math.random() < 0.5;
          } catch { abEnabled = Math.random() < 0.5; }

          if (abEnabled) {
            await agentLog('Autonomous Engine', `${label} Criando variante A/B para "${topic}"...`, { type: 'communication', to: 'A/B Testing' });
            await createABVariant({
              id: saved.id,
              topic: generated.topic || topic,
              contentType: postContentType,
              scheduledFor,
              viralScore,
              message: generated.message,
            });
          }
        } catch (abErr: any) {
          await agentLog('A/B Testing', `${label} ⚠️ Falha ao criar variante: ${abErr.message}`, { type: 'error' });
        }
      }
    } catch (err: any) {
      await agentLog('Autonomous Engine', `${label} ❌ Erro ao gerar post ${i + 1}: ${err.message}`, { type: 'error' });
    }
  }

  return scheduledIds;
}

// Motor autônomo: roda todo dia às 07:00 e agenda posts do dia PARA CADA CLIENT ATIVO
export function startAutonomousContentEngine() {
  cron.schedule('5 7 * * *', async () => {
    await trackAgentExecution('content-engine', async () => {
    await agentLog('Autonomous Engine', '🚀 Iniciando ciclo autônomo MULTI-PAGE de conteúdo do dia...', { type: 'action' });
    try {
      // Load ALL active clients (with or without Facebook page config)
      // Clients WITH facebookPageId/Token → publish to their page
      // Clients WITHOUT (like Newplay) → publish via env var default page
      const activeClients = await prisma.client.findMany({
        where: { isActive: true, status: 'ACTIVE' },
        select: { id: true, name: true, niche: true, notes: true, facebookPageName: true, facebookPageId: true, facebookAccessToken: true },
      });

      let totalScheduled = 0;
      const clientSummaries: string[] = [];

      if (activeClients.length === 0) {
        // No clients at all — run for default page (backward compat)
        await agentLog('Autonomous Engine', 'Nenhum client ativo — rodando para página padrão (env vars)', { type: 'info' });
        const ids = await generatePostsForClient();
        totalScheduled = ids.length;
        clientSummaries.push(`Default: ${ids.length} posts`);
      } else {
        // Generate content for EACH active client
        for (const client of activeClients) {
          try {
            // Skip clients without any page config AND without env var fallback possible
            const hasOwnPage = client.facebookPageId && client.facebookAccessToken;
            const hasEnvFallback = process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_ACCESS_TOKEN;
            if (!hasOwnPage && !hasEnvFallback) {
              await agentLog('Autonomous Engine', `⚠️ ${client.name}: sem page config e sem env vars. Pulando.`, { type: 'info' });
              continue;
            }

            await agentLog('Autonomous Engine', `--- Gerando conteúdo para ${client.name} (nicho: ${client.niche || 'geral'}) ---`, { type: 'action' });
            const ids = await generatePostsForClient({
              clientId: client.id,
              clientName: client.name,
              niche: client.niche || 'geral',
              facebookPageName: client.facebookPageName || undefined,
              notes: client.notes || undefined,
            });
            totalScheduled += ids.length;
            clientSummaries.push(`${client.name}: ${ids.length} posts`);
          } catch (clientErr: any) {
            await agentLog('Autonomous Engine', `❌ Erro ao gerar conteúdo para ${client.name}: ${clientErr.message}`, { type: 'error' });
            clientSummaries.push(`${client.name}: ERRO`);
          }
        }
      }

      // Notify admins
      if (totalScheduled > 0) {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        const summary = clientSummaries.join(' | ');
        for (const admin of admins) {
          await notificationsService.createAndEmit(admin.id, 'TASK_ASSIGNED', 'Motor autônomo multi-page ativo', `${totalScheduled} posts agendados hoje: ${summary}`);
        }
      }

      await agentLog('Autonomous Engine', `✅ Ciclo multi-page concluído. ${totalScheduled} posts totais agendados. ${clientSummaries.join(' | ')}`, { type: 'result' });
    } catch (err: any) {
      console.error('[Engine] Erro no ciclo autônomo:', err.message);
      await agentLog('Autonomous Engine', `❌ Erro no ciclo autônomo: ${err.message}`, { type: 'error' });
    }
    }); // trackAgentExecution
  });

  console.log('[Engine] Motor autônomo MULTI-PAGE iniciado (roda todo dia às 07:05)');
}

// Roda toda segunda-feira às 6h: analisa tendências e notifica admins
export function startTrendingTopicsAgent() {
  cron.schedule('0 6 * * 1', async () => {
    await trackAgentExecution('trending-topics', async () => {
    await agentLog('Trending Topics', '🔍 Analisando tendências da semana via Gemini AI...', { type: 'action', to: 'Gemini AI' });
    try {
      const report = await analyzeTrendingTopics();

      // Store in TrendingCache for Content Strategist consumption
      await prisma.trendingCache.create({
        data: {
          trends: report.trends as any,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const topicNames = report.trends.map((t: any) => t.topic).join(', ');

      await agentLog('Trending Topics', `📈 ${report.trends.length} tendências identificadas: ${topicNames}. Enviando para Content Strategist...`, { type: 'result', to: 'Content Strategist', payload: { trends: report.trends } });

      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await notificationsService.createAndEmit(admin.id, 'TASK_ASSIGNED', 'Tendências da semana prontas!', `${report.trends.length} temas em alta: ${topicNames}`);
      }
    } catch (err: any) {
      console.error('[Trending] Erro ao analisar tendências:', err.message);
      await agentLog('Trending Topics', `❌ Erro ao analisar tendências: ${err.message}`, { type: 'error' });
    }
    }); // trackAgentExecution
  });

  console.log('[Trending] Agente de tendências iniciado (roda toda segunda às 06:00)');
}

// Roda todo dia às 10h e 15h: orquestra posts de produtos TikTok Shop
export function startProductOrchestrator() {
  cron.schedule('0 10,15 * * *', async () => {
    await trackAgentExecution('tiktok-products', async () => {
    await agentLog('Product Orchestrator', '🛍️ Iniciando ciclo de produtos TikTok Shop...', { type: 'action', to: 'TikTok Researcher' });
    try {
      await agentLog('Product Orchestrator', 'Solicitando produtos em tendência ao TikTok Researcher...', { type: 'communication', to: 'TikTok Researcher' });
      const result = await orchestrateProductPosts();

      await agentLog('TikTok Researcher', `${result.productsFound} produtos encontrados em alta. Enviando para Copywriter...`, { type: 'result', to: 'Product Orchestrator' });
      if (result.postsCreated > 0) {
        await agentLog('Copywriter', `${result.postsCreated} copies persuasivos criados. Posts agendados para publicação.`, { type: 'result', to: 'Scheduler' });
      }
      await agentLog('Product Orchestrator', `✅ Ciclo concluído: ${result.productsFound} produtos, ${result.postsCreated} posts agendados.`, { type: 'result', payload: result });
    } catch (err: any) {
      console.error('[Products] Erro no ciclo de produtos:', err.message);
      await agentLog('Product Orchestrator', `❌ Erro no ciclo de produtos: ${err.message}`, { type: 'error' });
    }
    }); // trackAgentExecution
  });

  console.log('[Products] Orquestrador de produtos iniciado (roda às 10:00 e 15:00)');
}

// Verifica token do Facebook todo dia às 9h
export function startTokenMonitor() {
  cron.schedule('0 9 * * *', async () => {
    await trackAgentExecution('token-monitor', async () => {
    try {
      await agentLog('Token Monitor', '🔑 Verificando validade do token do Facebook...', { type: 'action', to: 'Facebook API' });
      await runTokenMonitor();
      await agentLog('Token Monitor', '✅ Token do Facebook verificado com sucesso.', { type: 'result' });
    } catch (err: any) {
      console.error('[TokenMonitor] Erro:', err.message);
      await agentLog('Token Monitor', `❌ Problema com token do Facebook: ${err.message}`, { type: 'error' });
    }
    }); // trackAgentExecution
  });

  runTokenMonitor().catch(() => {});
  console.log('[TokenMonitor] Monitor de token iniciado (verifica todo dia às 09:00)');
}

// Maps DB function field → actual start function
const AGENT_FUNCTION_MAP: Record<string, () => void> = {
  'post-scheduler': startPostScheduler,
  'comment-responder': startCommentResponder,
  'metrics-collector': startMetricsAnalyzer,
  'deadline-notifier': startDueDateNotifier,
  'content-engine': startAutonomousContentEngine,
  'trending-topics': startTrendingTopicsAgent,
  'tiktok-products': startProductOrchestrator,
  'token-monitor': startTokenMonitor,
  'content-governor': startContentGovernor,
  'growth-director': startGrowthDirector,
  'system-sentinel': startSystemSentinel,
  'performance-learner': startPerformanceLearner,
  'ab-testing': startABTestingEngine,
  'reputation-monitor': startReputationMonitor,
  'lead-capture': startLeadCaptureAgent,
  'strategic-command': startStrategicCommandAgent,
  'niche-learning': startNicheLearningAgent,
  'strategic-engine': startStrategicEngine,
  'evolution-engine': startEvolutionEngine,
  'short-video-engine': startShortVideoEngine,
  'growth-analyst': startGrowthAnalyst,
  'video-processor': startVideoProcessor,
};

export async function updateLastRun(agentName: string): Promise<void> {
  try {
    await prisma.agent.updateMany({
      where: { OR: [{ name: agentName }, { function: agentName }] },
      data: { lastRunAt: new Date() },
    });
  } catch {}
}

export async function startAllAgents() {
  // Try loading active cron agents from DB
  let startedFromDB = false;
  try {
    const activeAgents = await prisma.agent.findMany({
      where: { status: 'active', cronExpression: { not: null } },
    });

    if (activeAgents.length > 0) {
      startedFromDB = true;
      let started = 0;
      for (const agent of activeAgents) {
        const fn = AGENT_FUNCTION_MAP[agent.function];
        if (fn) {
          fn();
          started++;
        }
      }
      console.log(`[Agents] ${started}/${activeAgents.length} cron agents started from DB`);
    }
  } catch {
    // DB not ready or agents table doesn't exist yet — fall back to hardcoded
  }

  // Fallback: start all if DB didn't provide agents
  if (!startedFromDB) {
    for (const fn of Object.values(AGENT_FUNCTION_MAP)) {
      fn();
    }
    console.log(`[Agents] ${Object.keys(AGENT_FUNCTION_MAP).length} agents started (hardcoded fallback)`);
  }

  // Seed brand config on startup
  seedBrandConfig().catch(() => {});
  agentLog('Sistema', `All agents started (DB-driven: ${startedFromDB}).`, { type: 'info' }).catch(() => {});
  console.log('[Agents] Todos os agentes iniciados ✓');
}
