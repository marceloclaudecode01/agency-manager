import { pauseAgent, resumeAgent, activateSafeMode, deactivateSafeMode, getSafeModeStatus } from '../../../agents/safe-mode';
import { runSentinel } from '../../../agents/system-sentinel.agent';
import { agentLog } from '../../../agents/agent-logger';
import prisma from '../../../config/database';
import { generatePostFromStrategy } from '../../../agents/content-creator.agent';
import { buildDailyStrategy } from '../../../agents/content-strategist.agent';
import { enhanceWithViralMechanics } from '../../../agents/viral-mechanics.agent';
import { optimizeForPlatform } from '../../../agents/platform-optimizer.agent';
import { generateImageForPost } from '../../../agents/image-generator.agent';
import { SocialService } from '../../social/social.service';

export interface CommandResult {
  command: string;
  success: boolean;
  message: string;
  data?: any;
}

// Fuzzy map: user input → real agent names (PT + EN)
const AGENT_ALIASES: Record<string, string> = {
  'scheduler': 'post-scheduler',
  'agendador': 'post-scheduler',
  'publicador': 'post-scheduler',
  'motor': 'content-engine',
  'engine': 'content-engine',
  'metricas': 'metrics-collector',
  'metrics': 'metrics-collector',
  'token': 'token-monitor',
  'tiktok': 'tiktok-products',
  'tendencias': 'trending-topics',
  'trending': 'trending-topics',
  'comentarios': 'comment-responder',
  'comments': 'comment-responder',
  'prazos': 'deadline-notifier',
  'deadline': 'deadline-notifier',
  'governor': 'content-governor',
  'growth': 'growth-director',
  'ab test': 'ab-testing',
  'teste ab': 'ab-testing',
  'viral': 'viral-mechanics',
  'reputacao': 'reputation-monitor',
  'reputation': 'reputation-monitor',
  'lead': 'lead-capture',
  'leads': 'lead-capture',
  'strategic': 'strategic-command',
  'estrategia': 'strategic-command',
  'niche': 'niche-learning',
  'nicho': 'niche-learning',
  'compliance': 'policy-compliance',
  'variation': 'pattern-variation',
  'variacao': 'pattern-variation',
  'sentinel': 'system-sentinel',
  'sentinela': 'system-sentinel',
  'performance': 'performance-learner',
  'brand': 'brand-brain',
  'marca': 'brand-brain',
  'strategist': 'content-strategist',
  'orchestrator': 'orchestrator',
  'facebook': 'facebook-publisher',
  'instagram': 'instagram-sync',
  'campaign': 'campaign-manager',
  'campanha': 'campaign-manager',
  'roi': 'roi-intel',
  'safe mode': 'safe-mode',
  'modo seguro': 'safe-mode',
};

function resolveAgent(input: string): string {
  const lower = input.toLowerCase().trim();
  return AGENT_ALIASES[lower] || lower;
}

interface CommandDef {
  name: string;
  patterns: RegExp[];
  requiredRole: 'ADMIN' | 'MANAGER' | 'MEMBER';
  execute: (match: RegExpMatchArray) => Promise<CommandResult>;
}

const COMMANDS: CommandDef[] = [
  {
    name: 'pause_agent',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:pausar?|pause|parar?|stop)\s+(?:o\s+)?(?:agente?\s+)?(.+)/i,
    ],
    execute: async (match) => {
      const agentFunction = resolveAgent(match[1]);
      try {
        const agent = await prisma.agent.findFirst({
          where: { OR: [{ name: { contains: match[1].trim(), mode: 'insensitive' as any } }, { function: agentFunction }] },
        });
        if (agent) {
          await prisma.agent.update({ where: { id: agent.id }, data: { status: 'paused' } });
        } else {
          await pauseAgent(agentFunction); // legacy fallback
        }
        await agentLog('Easyorios', `Comando: pausar agente "${agent?.name || agentFunction}"`, { type: 'action' });
        return { command: 'pause_agent', success: true, message: `Agente "${agent?.name || agentFunction}" pausado com sucesso.` };
      } catch (e: any) {
        return { command: 'pause_agent', success: false, message: `Falha ao pausar "${agentFunction}": ${e.message}` };
      }
    },
  },
  {
    name: 'resume_agent',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:retomar|resume|reativar?|reactivate|despausar?|unpause)\s+(?:o\s+)?(?:agente?\s+)?(.+)/i,
    ],
    execute: async (match) => {
      const agentFunction = resolveAgent(match[1]);
      try {
        const agent = await prisma.agent.findFirst({
          where: { OR: [{ name: { contains: match[1].trim(), mode: 'insensitive' as any } }, { function: agentFunction }] },
        });
        if (agent) {
          await prisma.agent.update({ where: { id: agent.id }, data: { status: 'active' } });
        } else {
          await resumeAgent(agentFunction); // legacy fallback
        }
        await agentLog('Easyorios', `Comando: retomar agente "${agent?.name || agentFunction}"`, { type: 'action' });
        return { command: 'resume_agent', success: true, message: `Agente "${agent?.name || agentFunction}" retomado com sucesso.` };
      } catch (e: any) {
        return { command: 'resume_agent', success: false, message: `Falha ao retomar "${agentFunction}": ${e.message}` };
      }
    },
  },
  {
    name: 'safe_mode_on',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:ativar?|activate|ligar?|enable)\s+(?:o\s+)?(?:safe\s*mode|modo\s*seguro)/i,
    ],
    execute: async () => {
      try {
        await activateSafeMode('Ativado via Easyorios chat', 'Easyorios');
        await agentLog('Easyorios', 'Comando: ativar safe mode', { type: 'action' });
        return { command: 'safe_mode_on', success: true, message: 'Safe Mode ATIVADO. Todos os agentes autônomos estão pausados.' };
      } catch (e: any) {
        return { command: 'safe_mode_on', success: false, message: `Falha ao ativar safe mode: ${e.message}` };
      }
    },
  },
  {
    name: 'safe_mode_off',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:desativar?|deactivate|desligar?|disable)\s+(?:o\s+)?(?:safe\s*mode|modo\s*seguro)/i,
    ],
    execute: async () => {
      try {
        await deactivateSafeMode();
        await agentLog('Easyorios', 'Comando: desativar safe mode', { type: 'action' });
        return { command: 'safe_mode_off', success: true, message: 'Safe Mode DESATIVADO. Agentes voltaram ao normal.' };
      } catch (e: any) {
        return { command: 'safe_mode_off', success: false, message: `Falha ao desativar safe mode: ${e.message}` };
      }
    },
  },
  {
    name: 'run_sentinel',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:rodar?|run|executar?|execute)\s+(?:o\s+)?sentinel/i,
      /sentinel\s+(?:scan|check|verificar?|checar?)/i,
    ],
    execute: async () => {
      try {
        const report = await runSentinel();
        await agentLog('Easyorios', 'Comando: executar sentinel scan', { type: 'action' });
        return { command: 'run_sentinel', success: true, message: 'Sentinel scan concluído.', data: report };
      } catch (e: any) {
        return { command: 'run_sentinel', success: false, message: `Falha ao executar sentinel: ${e.message}` };
      }
    },
  },
  {
    name: 'override_post',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:aprovar?|approve)\s+(?:o\s+)?post\s+#?(\d+)/i,
      /(?:rejeitar?|reject)\s+(?:o\s+)?post\s+#?(\d+)/i,
    ],
    execute: async (match) => {
      const postId = match[1];
      const isApprove = /aprovar?|approve/i.test(match[0]);
      const newDecision = isApprove ? 'APPROVED' : 'REJECTED';
      try {
        await prisma.scheduledPost.update({
          where: { id: postId },
          data: { governorDecision: newDecision, governorReason: `Override manual via Easyorios`, governorReviewedAt: new Date() },
        });
        await agentLog('Easyorios', `Comando: override post #${postId} → ${newDecision}`, { type: 'action' });
        return { command: 'override_post', success: true, message: `Post #${postId} marcado como ${newDecision}.` };
      } catch (e: any) {
        return { command: 'override_post', success: false, message: `Falha ao alterar post #${postId}: ${e.message}` };
      }
    },
  },
  {
    name: 'get_status',
    requiredRole: 'MEMBER',
    patterns: [
      /(?:status|estado)\s+(?:do\s+)?(?:sistema|system)/i,
      /system\s+status/i,
    ],
    execute: async () => {
      try {
        const safeStatus = await getSafeModeStatus();
        const pausedFromDB = await prisma.agent.findMany({ where: { status: 'paused' } }).catch(() => []);
        const paused = pausedFromDB.map((a: any) => a.name);
        await agentLog('Easyorios', 'Comando: consultar status do sistema', { type: 'action' });
        return {
          command: 'get_status',
          success: true,
          message: `Safe Mode: ${safeStatus.enabled ? 'ATIVO' : 'desativado'}${safeStatus.reason ? ` (${safeStatus.reason})` : ''}. Agentes pausados: ${paused.length > 0 ? paused.join(', ') : 'nenhum'}.`,
          data: { safeMode: safeStatus, pausedAgents: paused },
        };
      } catch (e: any) {
        return { command: 'get_status', success: false, message: `Falha ao consultar status: ${e.message}` };
      }
    },
  },
  // ─── PUBLISH NOW — Generate + publish immediately ───
  {
    name: 'publish_now',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:publicar?|postar?|publish)\s+(?:(?:um\s+)?(?:post\s+|publicacao\s+|publicação\s+)?)?(?:agora|now|ja|já|imediato|imediatamente)/i,
      /(?:criar?|create|gerar?|generate)\s+(?:e\s+)?(?:publicar?|postar?)\s+(?:(?:um\s+)?(?:post\s+)?)?(?:agora|now|ja|já)/i,
      /(?:manda|faz|faca|faça)\s+(?:um\s+)?(?:post|publicacao|publicação)\s+(?:agora|now|ja|já)/i,
      /(?:quero|preciso|pode|vamos)\s+(?:publicar?|postar?)\s+(?:(?:um\s+)?(?:post\s+)?)?(?:agora|now|ja|já)/i,
    ],
    execute: async (match) => {
      try {
        await agentLog('Easyorios', 'Comando: publicar agora — acionando pipeline completo', { type: 'action' });

        // Get a client (prefer first active with page config)
        const client = await prisma.client.findFirst({
          where: { isActive: true, status: 'ACTIVE', facebookPageId: { not: null }, facebookAccessToken: { not: null } },
          select: { id: true, name: true, niche: true, notes: true, facebookPageId: true, facebookAccessToken: true },
        });

        // Build strategy for 1 post
        const strategy = await buildDailyStrategy(client ? {
          clientId: client.id, clientName: client.name, niche: client.niche || 'geral', notes: client.notes || undefined,
        } : undefined);

        const topic = strategy.topics[0];
        const focusType = strategy.focusType[0] || 'educativo';

        // Get recent topics for anti-duplication
        const recentPosts = await prisma.scheduledPost.findMany({
          where: { status: 'PUBLISHED', ...(client ? { clientId: client.id } : {}) },
          orderBy: { publishedAt: 'desc' }, take: 30, select: { topic: true },
        });
        const recentTopics = recentPosts.map(p => p.topic).filter(Boolean) as string[];

        // Generate post
        let generated = await generatePostFromStrategy(topic, focusType, recentTopics, client?.niche || undefined, client?.notes || undefined);

        // Viral Mechanics
        try {
          const enhanced = await enhanceWithViralMechanics(generated.message, topic, focusType);
          generated.message = enhanced.enhancedMessage;
        } catch {}

        // Platform Optimizer
        try {
          const optimized = optimizeForPlatform(generated.message, generated.hashtags || [], 'facebook');
          generated.message = optimized.message;
          generated.hashtags = optimized.hashtags;
        } catch {}

        // Generate image
        let imageUrl: string | null = null;
        try {
          const img = await generateImageForPost(topic, focusType);
          imageUrl = img.url || null;
        } catch {}

        const hashtagsStr = generated.hashtags?.map((h: string) => `#${h.replace('#', '')}`).join(' ') || null;
        const fullMessage = hashtagsStr ? `${generated.message}\n\n${hashtagsStr}` : generated.message;

        // Build SocialService for this client
        let socialService: SocialService;
        if (client?.facebookPageId && client?.facebookAccessToken) {
          socialService = new SocialService({ pageId: client.facebookPageId, accessToken: client.facebookAccessToken });
        } else {
          socialService = new SocialService();
        }

        // Publish directly
        const publishResult = imageUrl
          ? await socialService.publishMediaPost(fullMessage, imageUrl, { mediaType: 'image' })
          : await socialService.publishPost(fullMessage);

        // Save to DB as PUBLISHED
        await prisma.scheduledPost.create({
          data: {
            topic: generated.topic || topic,
            message: generated.message,
            hashtags: hashtagsStr,
            imageUrl,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            scheduledFor: new Date(),
            source: 'easyorios-command',
            contentType: 'organic',
            governorDecision: 'APPROVE',
            governorReason: 'Publicação direta via Easyorios',
            metaPostId: publishResult?.id || null,
            ...(client ? { clientId: client.id } : {}),
          },
        });

        await agentLog('Easyorios', `Post publicado AGORA: "${topic}" (${client?.name || 'default'})`, { type: 'result' });
        return {
          command: 'publish_now',
          success: true,
          message: `Post publicado com sucesso AGORA!\n📝 Tema: "${topic}"\n📄 Tipo: ${focusType}\n📱 Página: ${client?.name || 'padrão'}\n🆔 FB ID: ${publishResult?.id || 'N/A'}`,
          data: { topic, focusType, fbPostId: publishResult?.id, client: client?.name },
        };
      } catch (e: any) {
        await agentLog('Easyorios', `Falha ao publicar agora: ${e.message}`, { type: 'error' });
        return { command: 'publish_now', success: false, message: `Falha ao publicar: ${e.message}` };
      }
    },
  },
  // ─── SCHEDULE POST — Generate + schedule for specific time ───
  {
    name: 'schedule_post',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:publicar?|postar?|agendar?|schedule)\s+(?:para|at|as|às|pra)\s+(?:as\s+)?(\d{1,2})[h:]?(\d{2})?\b/i,
      /(?:agenda|cria|gera)\s+(?:um\s+)?(?:post|publicacao|publicação)\s+(?:para|as|às|pra)\s+(?:as\s+)?(\d{1,2})[h:]?(\d{2})?\b/i,
      /(?:manda|faz|faca|faça)\s+(?:um\s+)?(?:post|publicacao|publicação)\s+(?:para|as|às|pra)\s+(?:as\s+)?(\d{1,2})[h:]?(\d{2})?\b/i,
    ],
    execute: async (match) => {
      try {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2] || '0');
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          return { command: 'schedule_post', success: false, message: 'Horário inválido. Use formato HH:MM (ex: 14:30).' };
        }

        await agentLog('Easyorios', `Comando: agendar post para ${hours}:${String(minutes).padStart(2, '0')}`, { type: 'action' });

        const client = await prisma.client.findFirst({
          where: { isActive: true, status: 'ACTIVE', facebookPageId: { not: null }, facebookAccessToken: { not: null } },
          select: { id: true, name: true, niche: true, notes: true },
        });

        const strategy = await buildDailyStrategy(client ? {
          clientId: client.id, clientName: client.name, niche: client.niche || 'geral', notes: client.notes || undefined,
        } : undefined);

        const topic = strategy.topics[0];
        const focusType = strategy.focusType[0] || 'educativo';

        const recentPosts = await prisma.scheduledPost.findMany({
          where: { status: 'PUBLISHED', ...(client ? { clientId: client.id } : {}) },
          orderBy: { publishedAt: 'desc' }, take: 30, select: { topic: true },
        });
        const recentTopics = recentPosts.map(p => p.topic).filter(Boolean) as string[];

        let generated = await generatePostFromStrategy(topic, focusType, recentTopics, client?.niche || undefined, client?.notes || undefined);

        try {
          const enhanced = await enhanceWithViralMechanics(generated.message, topic, focusType);
          generated.message = enhanced.enhancedMessage;
        } catch {}

        try {
          const optimized = optimizeForPlatform(generated.message, generated.hashtags || [], 'facebook');
          generated.message = optimized.message;
          generated.hashtags = optimized.hashtags;
        } catch {}

        let imageUrl: string | null = null;
        try {
          const img = await generateImageForPost(topic, focusType);
          imageUrl = img.url || null;
        } catch {}

        const hashtagsStr = generated.hashtags?.map((h: string) => `#${h.replace('#', '')}`).join(' ') || null;

        const scheduledFor = new Date();
        scheduledFor.setHours(hours, minutes, 0, 0);
        // If time already passed today, schedule for tomorrow
        if (scheduledFor.getTime() < Date.now()) {
          scheduledFor.setDate(scheduledFor.getDate() + 1);
        }

        const saved = await prisma.scheduledPost.create({
          data: {
            topic: generated.topic || topic,
            message: generated.message,
            hashtags: hashtagsStr,
            imageUrl,
            status: 'APPROVED',
            scheduledFor,
            source: 'easyorios-command',
            contentType: 'organic',
            governorDecision: 'APPROVE',
            governorReason: 'Agendado via Easyorios',
            ...(client ? { clientId: client.id } : {}),
          },
        });

        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const dateStr = scheduledFor.toLocaleDateString('pt-BR');
        await agentLog('Easyorios', `Post agendado para ${timeStr} (${dateStr}): "${topic}"`, { type: 'result' });
        return {
          command: 'schedule_post',
          success: true,
          message: `Post agendado com sucesso!\n📝 Tema: "${topic}"\n📄 Tipo: ${focusType}\n⏰ Horário: ${timeStr} (${dateStr})\n📱 Página: ${client?.name || 'padrão'}\n🆔 ID: ${saved.id}`,
          data: { topic, focusType, scheduledFor: scheduledFor.toISOString(), postId: saved.id },
        };
      } catch (e: any) {
        await agentLog('Easyorios', `Falha ao agendar post: ${e.message}`, { type: 'error' });
        return { command: 'schedule_post', success: false, message: `Falha ao agendar: ${e.message}` };
      }
    },
  },
  // ─── RESCHEDULE POST — Change schedule time of existing post ───
  {
    name: 'reschedule_post',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:alterar?|mudar?|trocar?|change|reschedule|reagendar?)\s+(?:o\s+)?(?:horario|horário|hora|time|schedule)\s+(?:do\s+)?(?:post\s+)?(?:#)?(\S+)\s+(?:para|to|pra)\s+(?:as\s+)?(\d{1,2})[h:]?(\d{2})?\b/i,
      /(?:mover?|move)\s+(?:o\s+)?(?:post\s+)?(?:#)?(\S+)\s+(?:para|to|pra)\s+(?:as\s+)?(\d{1,2})[h:]?(\d{2})?\b/i,
    ],
    execute: async (match) => {
      const postId = match[1];
      const hours = parseInt(match[2]);
      const minutes = parseInt(match[3] || '0');
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return { command: 'reschedule_post', success: false, message: 'Horário inválido. Use formato HH:MM.' };
      }

      try {
        const post = await prisma.scheduledPost.findFirst({
          where: {
            OR: [
              { id: postId },
              { topic: { contains: postId, mode: 'insensitive' as any } },
            ],
            status: { in: ['PENDING', 'APPROVED'] },
          },
        });

        if (!post) {
          return { command: 'reschedule_post', success: false, message: `Post "${postId}" não encontrado ou já publicado.` };
        }

        const newTime = new Date(post.scheduledFor);
        newTime.setHours(hours, minutes, 0, 0);
        if (newTime.getTime() < Date.now()) {
          newTime.setDate(newTime.getDate() + 1);
        }

        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { scheduledFor: newTime },
        });

        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        await agentLog('Easyorios', `Post "${post.topic}" reagendado para ${timeStr}`, { type: 'action' });
        return {
          command: 'reschedule_post',
          success: true,
          message: `Post reagendado!\n📝 "${post.topic}"\n⏰ Novo horário: ${timeStr}\n🆔 ID: ${post.id}`,
          data: { postId: post.id, topic: post.topic, newScheduledFor: newTime.toISOString() },
        };
      } catch (e: any) {
        return { command: 'reschedule_post', success: false, message: `Falha ao reagendar: ${e.message}` };
      }
    },
  },
  // ─── PUBLISH FOR CLIENT — Generate + publish for specific client ───
  {
    name: 'publish_for_client',
    requiredRole: 'ADMIN',
    patterns: [
      /(?:publicar?|postar?|publish)\s+(?:para|for|no|na|do|da)\s+(?:a?\s+)?(?:pagina|página|page|client[e]?)\s+(?:do?\s+|da?\s+)?(.+?)(?:\s+agora|\s+now|\s+ja|\s+já)?$/i,
      /(?:publicar?|postar?)\s+(?:agora\s+)?(?:para|no|na)\s+(.+)/i,
    ],
    execute: async (match) => {
      try {
        const clientSearch = match[1].trim();
        const client = await prisma.client.findFirst({
          where: {
            OR: [
              { name: { contains: clientSearch, mode: 'insensitive' as any } },
              { facebookPageName: { contains: clientSearch, mode: 'insensitive' as any } },
            ],
            isActive: true,
          },
          select: { id: true, name: true, niche: true, notes: true, facebookPageId: true, facebookAccessToken: true },
        });

        if (!client) {
          return { command: 'publish_for_client', success: false, message: `Cliente "${clientSearch}" não encontrado. Clientes ativos estão no banco.` };
        }
        if (!client.facebookPageId || !client.facebookAccessToken) {
          return { command: 'publish_for_client', success: false, message: `Cliente "${client.name}" não tem page config (pageId/token).` };
        }

        await agentLog('Easyorios', `Comando: publicar agora para ${client.name}`, { type: 'action' });

        const strategy = await buildDailyStrategy({
          clientId: client.id, clientName: client.name, niche: client.niche || 'geral', notes: client.notes || undefined,
        });

        const topic = strategy.topics[0];
        const focusType = strategy.focusType[0] || 'educativo';

        const recentPosts = await prisma.scheduledPost.findMany({
          where: { status: 'PUBLISHED', clientId: client.id },
          orderBy: { publishedAt: 'desc' }, take: 30, select: { topic: true },
        });
        const recentTopics = recentPosts.map(p => p.topic).filter(Boolean) as string[];

        let generated = await generatePostFromStrategy(topic, focusType, recentTopics, client.niche || undefined, client.notes || undefined);

        try {
          const enhanced = await enhanceWithViralMechanics(generated.message, topic, focusType);
          generated.message = enhanced.enhancedMessage;
        } catch {}

        try {
          const optimized = optimizeForPlatform(generated.message, generated.hashtags || [], 'facebook');
          generated.message = optimized.message;
          generated.hashtags = optimized.hashtags;
        } catch {}

        let imageUrl: string | null = null;
        try {
          const img = await generateImageForPost(topic, focusType);
          imageUrl = img.url || null;
        } catch {}

        const hashtagsStr = generated.hashtags?.map((h: string) => `#${h.replace('#', '')}`).join(' ') || null;
        const fullMessage = hashtagsStr ? `${generated.message}\n\n${hashtagsStr}` : generated.message;

        const socialService = new SocialService({ pageId: client.facebookPageId, accessToken: client.facebookAccessToken });
        const publishResult = imageUrl
          ? await socialService.publishMediaPost(fullMessage, imageUrl, { mediaType: 'image' })
          : await socialService.publishPost(fullMessage);

        await prisma.scheduledPost.create({
          data: {
            topic: generated.topic || topic,
            message: generated.message,
            hashtags: hashtagsStr,
            imageUrl,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            scheduledFor: new Date(),
            source: 'easyorios-command',
            contentType: 'organic',
            governorDecision: 'APPROVE',
            governorReason: `Publicação direta via Easyorios para ${client.name}`,
            metaPostId: publishResult?.id || null,
            clientId: client.id,
          },
        });

        await agentLog('Easyorios', `Post publicado AGORA para ${client.name}: "${topic}"`, { type: 'result' });
        return {
          command: 'publish_for_client',
          success: true,
          message: `Post publicado para ${client.name}!\n📝 Tema: "${topic}"\n📄 Tipo: ${focusType}\n🆔 FB ID: ${publishResult?.id || 'N/A'}`,
          data: { topic, client: client.name, fbPostId: publishResult?.id },
        };
      } catch (e: any) {
        await agentLog('Easyorios', `Falha ao publicar para cliente: ${e.message}`, { type: 'error' });
        return { command: 'publish_for_client', success: false, message: `Falha: ${e.message}` };
      }
    },
  },
  // ─── LIST PENDING POSTS ───
  {
    name: 'list_pending',
    requiredRole: 'MEMBER',
    patterns: [
      /(?:listar?|list|mostrar?|show|ver)\s+(?:os?\s+)?(?:posts?\s+)?(?:pendente|pending|agendado|scheduled|fila|queue)/i,
      /(?:que|quais)\s+posts?\s+(?:estão|estao|tem|temos)\s+(?:pendente|agendado|na\s+fila)/i,
    ],
    execute: async () => {
      try {
        const posts = await prisma.scheduledPost.findMany({
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          orderBy: { scheduledFor: 'asc' },
          take: 10,
          select: { id: true, topic: true, scheduledFor: true, status: true, contentType: true, clientId: true },
        });

        if (posts.length === 0) {
          return { command: 'list_pending', success: true, message: 'Nenhum post pendente ou agendado no momento.' };
        }

        const lines = posts.map((p, i) => {
          const time = p.scheduledFor.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          return `${i + 1}. "${p.topic}" — ${time} [${p.status}] (ID: ${p.id.slice(-6)})`;
        });

        return {
          command: 'list_pending',
          success: true,
          message: `📋 ${posts.length} posts na fila:\n${lines.join('\n')}`,
          data: { posts },
        };
      } catch (e: any) {
        return { command: 'list_pending', success: false, message: `Falha: ${e.message}` };
      }
    },
  },
];

export function matchCommand(userMessage: string): { def: CommandDef; match: RegExpMatchArray } | null {
  for (const def of COMMANDS) {
    for (const pattern of def.patterns) {
      const match = userMessage.match(pattern);
      if (match) return { def, match };
    }
  }
  return null;
}

const ROLE_HIERARCHY: Record<string, number> = { ADMIN: 3, MANAGER: 2, MEMBER: 1 };

export async function executeCommand(userMessage: string, userRole?: string): Promise<CommandResult | null> {
  const found = matchCommand(userMessage);
  if (!found) return null;

  // Enforce role-based access control
  const requiredLevel = ROLE_HIERARCHY[found.def.requiredRole] || 1;
  const userLevel = ROLE_HIERARCHY[userRole || 'MEMBER'] || 1;
  if (userLevel < requiredLevel) {
    return {
      command: found.def.name,
      success: false,
      message: `Permissão insuficiente. Este comando requer role ${found.def.requiredRole}.`,
    };
  }

  return found.def.execute(found.match);
}

export const COMMAND_LIST = `
COMANDOS DISPONÍVEIS (o usuário pode pedir em linguagem natural):
- Pausar/retomar agentes: "pausar o scheduler", "retomar o governor"
- Safe Mode: "ativar safe mode", "desativar modo seguro"
- Sentinel: "rodar sentinel", "sentinel check"
- Override post: "aprovar post #123", "rejeitar post #456"
- Status sistema: "status do sistema", "system status"
- PUBLICAR AGORA: "publicar agora", "postar agora", "faz um post agora"
- AGENDAR POST: "publicar para as 14:30", "agendar para 18h", "postar às 20:00"
- REAGENDAR: "alterar horário do post X para 15:00", "mover post X para 20h"
- PUBLICAR POR CLIENTE: "publicar para Federal", "postar na página do Newplay agora"
- VER FILA: "listar posts pendentes", "ver posts agendados", "mostrar fila"
Quando um comando é executado, você receberá o resultado para narrar ao usuário.
IMPORTANTE: Você tem AUTORIDADE TOTAL para acionar os agentes. Quando o usuário pede para publicar, agendar ou alterar horários, EXECUTE o comando — não apenas explique.`;
