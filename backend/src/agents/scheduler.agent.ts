import cron from 'node-cron';
import prisma from '../config/database';
import { SocialService } from '../modules/social/social.service';
import { generateCommentReply } from './comment-responder.agent';
import { analyzeMetrics } from './metrics-analyzer.agent';

const socialService = new SocialService();

// Limite de segurança: máx 5 posts por dia, mínimo 2h de intervalo
const MAX_POSTS_PER_DAY = 5;
const MIN_INTERVAL_HOURS = 2;

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

// Roda a cada 5 minutos: verifica posts agendados para publicar
export function startPostScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // Busca posts aprovados com scheduledFor <= agora
      const pendingPosts = await prisma.scheduledPost.findMany({
        where: {
          status: 'APPROVED',
          scheduledFor: { lte: now },
        },
        orderBy: { scheduledFor: 'asc' },
        take: 1, // publica um por vez
      });

      if (pendingPosts.length === 0) return;

      // Verificações de segurança
      const postsToday = await getPostsPublishedToday();
      if (postsToday >= MAX_POSTS_PER_DAY) {
        console.log(`[Scheduler] Limite diário atingido (${MAX_POSTS_PER_DAY} posts). Aguardando amanhã.`);
        return;
      }

      const lastPublished = await getLastPublishedAt();
      if (lastPublished) {
        const hoursSinceLast = (now.getTime() - lastPublished.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < MIN_INTERVAL_HOURS) {
          console.log(`[Scheduler] Intervalo mínimo não atingido. Próximo post em ${(MIN_INTERVAL_HOURS - hoursSinceLast).toFixed(1)}h`);
          return;
        }
      }

      const post = pendingPosts[0];

      // Publica no Facebook
      const fullMessage = post.hashtags
        ? `${post.message}\n\n${post.hashtags}`
        : post.message;

      await socialService.publishPost(fullMessage);

      // Marca como publicado
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: now },
      });

      console.log(`[Scheduler] Post publicado: "${post.message.substring(0, 50)}..."`);
    } catch (err: any) {
      console.error('[Scheduler] Erro ao publicar post:', err.message);
    }
  });

  console.log('[Scheduler] Post scheduler iniciado (verificação a cada 5 minutos)');
}

// Roda a cada 30 minutos: verifica e responde comentários novos
export function startCommentResponder() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const posts = await socialService.getPosts(5);

      for (const post of posts) {
        const comments = await socialService.getPostComments(post.id);

        for (const comment of comments) {
          // Verifica se já foi respondido
          const alreadyReplied = await prisma.commentLog.findFirst({
            where: { commentId: comment.id },
          });
          if (alreadyReplied) continue;

          // Gera resposta com IA
          const reply = await generateCommentReply(
            comment.message,
            post.message || post.story
          );

          if (!reply) {
            // Spam/ofensa — apenas loga
            await prisma.commentLog.create({
              data: { commentId: comment.id, action: 'IGNORED', reply: '' },
            });
            continue;
          }

          // Posta a resposta
          const GRAPH_API = 'https://graph.facebook.com/v19.0';
          const axios = (await import('axios')).default;
          await axios.post(`${GRAPH_API}/${comment.id}/comments`, null, {
            params: {
              message: reply,
              access_token: process.env.FACEBOOK_ACCESS_TOKEN,
            },
          });

          await prisma.commentLog.create({
            data: { commentId: comment.id, action: 'REPLIED', reply },
          });

          console.log(`[Comments] Respondido: "${comment.message.substring(0, 40)}" → "${reply.substring(0, 40)}"`);

          // Pausa 3s entre respostas para não parecer bot
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    } catch (err: any) {
      console.error('[Comments] Erro:', err.message);
    }
  });

  console.log('[Comments] Comment responder iniciado (verificação a cada 30 minutos)');
}

// Roda todo dia às 8h: análise de métricas
export function startMetricsAnalyzer() {
  cron.schedule('0 8 * * *', async () => {
    try {
      const pageInfo = await socialService.getPageInfo();
      const insights = await socialService.getPageInsights('week');
      const posts = await socialService.getPosts(7);

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
          rawData: { pageInfo, insights },
        },
      });

      console.log(`[Metrics] Relatório gerado. Score: ${report.growthScore}/10`);
    } catch (err: any) {
      console.error('[Metrics] Erro:', err.message);
    }
  });

  console.log('[Metrics] Metrics analyzer iniciado (roda todo dia às 08:00)');
}

export function startAllAgents() {
  startPostScheduler();
  startCommentResponder();
  startMetricsAnalyzer();
  console.log('[Agents] Todos os agentes iniciados ✓');
}
