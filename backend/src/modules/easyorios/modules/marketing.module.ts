import { EasyoriosModule, CommandDefinition, CommandResult, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import { executeCommand, matchCommand, COMMAND_LIST } from './marketing-commands';
import prisma from '../../../config/database';

export class MarketingModule implements EasyoriosModule {
  id = 'marketing';
  name = 'Marketing Digital';
  icon = 'Megaphone';
  contextPriority = 10;

  getCommands(): CommandDefinition[] {
    return [
      // Agency status — catch questions about the agency
      {
        name: 'agency_status',
        description: 'Status geral da agencia de marketing (agentes, posts, clientes, leads)',
        patterns: [
          /(?:como\s+(?:esta|está|vai|ta|tá)|ve[r]?|mostra|status)\s+(?:d?[ao]s?\s+)?(?:agencia|agência)/i,
          /(?:agencia|agência)\s+(?:status|como|esta|está)/i,
          /(?:status|estado|resumo|overview)\s+(?:do\s+)?(?:sistema|system|geral|marketing)/i,
          /system\s+status/i,
          /(?:quantos?|qual|quais)\s+(?:agentes?|posts?|clientes?|leads?)/i,
          /(?:o\s+que\s+(?:esta|está|ta|tá)\s+(?:acontecendo|rolando|rodando))/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, _userId) => {
          try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const oneDayAgo = new Date(Date.now() - 86400000);

            const [agents, activeAgents, pausedAgents, publishedToday, pending, totalPublished, leads, clients, actions24h] = await Promise.all([
              prisma.agent.count(),
              prisma.agent.count({ where: { status: 'active' } }),
              prisma.agent.count({ where: { status: 'paused' } }),
              prisma.scheduledPost.count({ where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } } }),
              prisma.scheduledPost.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } }),
              prisma.scheduledPost.count({ where: { status: 'PUBLISHED' } }),
              prisma.lead.count(),
              prisma.client.count({ where: { isActive: true } }),
              prisma.agentLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
            ]);

            const msg = [
              `Agentes: ${agents} total (${activeAgents} ativos, ${pausedAgents} pausados)`,
              `Posts hoje: ${publishedToday} publicados | ${pending} na fila`,
              `Total historico: ${totalPublished} posts publicados`,
              `Clientes ativos: ${clients}`,
              `Leads: ${leads}`,
              `Acoes dos agentes (24h): ${actions24h}`,
            ].join('\n');

            return {
              command: 'agency_status',
              success: true,
              message: msg,
              data: { agents, activeAgents, pausedAgents, publishedToday, pending, totalPublished, leads, clients, actions24h },
            };
          } catch (e: any) {
            return { command: 'agency_status', success: false, message: `Erro: ${e.message}` };
          }
        },
      },
      // All marketing commands — delegate to executeCommand
      {
        name: 'marketing_command',
        description: 'Comandos de marketing (pausar/retomar agentes, safe mode, publicar, agendar, etc.)',
        patterns: [
          /^(?:pausar?|pause|parar?|stop|retomar|resume|reativar?|reactivate|despausar?|unpause)\s+/i,
          /(?:ativar?|activate|ligar?|enable|desativar?|deactivate|desligar?|disable)\s+(?:o\s+)?(?:safe\s*mode|modo\s*seguro)/i,
          /(?:rodar?|run|executar?|execute)\s+(?:o\s+)?sentinel/i,
          /sentinel\s+(?:scan|check|verificar?|checar?)/i,
          /(?:aprovar?|approve|rejeitar?|reject)\s+(?:o\s+)?post\s+#?\d+/i,
          /(?:publicar?|postar?|publish)\s+(?:(?:um\s+)?(?:post\s+|publicacao\s+|publicação\s+)?)?(?:agora|now|ja|já|imediato|imediatamente)/i,
          /(?:criar?|create|gerar?|generate)\s+(?:e\s+)?(?:publicar?|postar?)\s+(?:(?:um\s+)?(?:post\s+)?)?(?:agora|now|ja|já)/i,
          /(?:manda|faz|faca|faça)\s+(?:um\s+)?(?:post|publicacao|publicação)\s+(?:agora|now|ja|já)/i,
          /(?:quero|preciso|pode|vamos)\s+(?:publicar?|postar?)\s+(?:(?:um\s+)?(?:post\s+)?)?(?:agora|now|ja|já)/i,
          /(?:publicar?|postar?|agendar?|schedule)\s+(?:para|at|as|às|pra)\s+(?:as\s+)?\d{1,2}[h:]?\d{0,2}\b/i,
          /(?:alterar?|mudar?|trocar?|change|reschedule|reagendar?)\s+(?:o\s+)?(?:horario|horário|hora|time|schedule)/i,
          /(?:publicar?|postar?|publish)\s+(?:para|for|no|na|do|da)\s+(?:a?\s+)?(?:pagina|página|page|client[e]?)/i,
          /(?:listar?|list|mostrar?|show|ver)\s+(?:os?\s+)?(?:posts?\s+)?(?:pendente|pending|agendado|scheduled|fila|queue)/i,
          /(?:que|quais)\s+posts?\s+(?:estão|estao|tem|temos)\s+(?:pendente|agendado|na\s+fila)/i,
          // Video / Reel commands
          /(?:publicar?|postar?|publish|criar?|create|gerar?|generate|fazer?|faz)\s+(?:um\s+)?(?:video|vídeo|reel|reels)/i,
          /(?:video|vídeo|reel|reels)\s+(?:sobre\s+)/i,
          /(?:manda|faz|faca|faça)\s+(?:um\s+)?(?:video|vídeo|reel|reels)/i,
          /(?:quero|preciso|pode|vamos)\s+(?:um\s+)?(?:video|vídeo|reel|reels)/i,
          /(?:agendar?|schedule)\s+(?:um\s+)?(?:video|vídeo|reel|reels)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, _userId, userRole) => {
          const result = await executeCommand(match.input || match[0], userRole);
          return result || { command: 'marketing_command', success: false, message: 'Comando nao reconhecido.' };
        },
      },
    ];
  }

  async gatherContext(_userId: string): Promise<ModuleContext> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const oneDayAgo = new Date(Date.now() - 86400000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const results = await Promise.allSettled([
      prisma.agent.count().catch(() => 0),
      prisma.scheduledPost.count({ where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } } }).catch(() => 0),
      prisma.scheduledPost.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.lead.count().catch(() => 0),
      prisma.agentLog.count({ where: { createdAt: { gte: oneDayAgo } } }).catch(() => 0),
      prisma.client.count({ where: { isActive: true } }).catch(() => 0),
      // Rich context from Orion's gatherAgencyContext
      prisma.lead.groupBy({ by: ['stage'], _count: true }).catch(() => []),
      Promise.all([
        prisma.funnel.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
        prisma.offer.aggregate({ _sum: { revenue: true } }).catch(() => ({ _sum: { revenue: null } })),
      ]),
      Promise.all([
        prisma.adCampaign.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
        prisma.adCampaign.aggregate({ _sum: { budget: true } }).catch(() => ({ _sum: { budget: null } })),
      ]),
      prisma.campaign.count().catch(() => 0),
      prisma.commentLog.groupBy({ by: ['sentiment'], where: { createdAt: { gte: sevenDaysAgo } }, _count: true }).catch(() => []),
      prisma.systemConfig.findFirst({ where: { key: 'safe_mode' } }).catch(() => null),
      prisma.scheduledPost.count({ where: { governorDecision: 'APPROVED' } }).catch(() => 0),
      prisma.strategicPlan.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null),
    ]);

    const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value : 0;

    const leadsByStage = val(6) || [];
    const totalLeads = (leadsByStage as any[]).reduce((s: number, g: any) => s + (g._count || 0), 0) || val(3);
    const activeFunnels = val(7)?.[0] ?? 0;
    const totalRevenue = val(7)?.[1]?._sum?.revenue ?? 0;
    const activeAdCampaigns = val(8)?.[0] ?? 0;
    const totalAdBudget = val(8)?.[1]?._sum?.budget ?? 0;
    const totalCampaigns = val(9);
    const sentimentBreakdown = val(10) || [];
    const safeMode = val(11)?.value ?? 'off';
    const postsGovernorApproved = val(12);
    const latestStrategy = val(13);
    const sentimentStr = (sentimentBreakdown as any[]).map((s: any) => `${s.sentiment}: ${s._count}`).join(', ') || 'sem dados';

    return {
      moduleId: 'marketing',
      summary: `${val(0)} agentes | ${val(1)} posts hoje | ${val(2)} pendentes | ${totalLeads} leads | ${val(5)} clientes | Safe: ${safeMode} | Revenue: R$${totalRevenue} | Ads: ${activeAdCampaigns} (R$${totalAdBudget}) | Sentiment: ${sentimentStr}`,
      metrics: {
        totalAgents: val(0),
        postsPublishedToday: val(1),
        postsPending: val(2),
        totalLeads,
        agentActions24h: val(4),
        activeClients: val(5),
        leadsByStage,
        activeFunnels,
        totalRevenue,
        activeAdCampaigns,
        totalAdBudget,
        totalCampaigns,
        sentimentBreakdown,
        safeMode,
        postsGovernorApproved,
        latestStrategy: latestStrategy?.title || null,
      },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Status Geral', prompt: 'Qual o status geral da agencia agora?', icon: 'Activity', moduleId: 'marketing' },
      { label: 'Performance', prompt: 'Como esta a performance dos posts e engajamento?', icon: 'BarChart3', moduleId: 'marketing' },
      { label: 'Publicar Agora', prompt: 'publicar agora', icon: 'Zap', moduleId: 'marketing' },
      { label: 'Publicar Video', prompt: 'publicar video', icon: 'Video', moduleId: 'marketing' },
      { label: 'Ver Fila', prompt: 'listar posts pendentes', icon: 'List', moduleId: 'marketing' },
      { label: 'Safe Mode ON', prompt: 'ativar safe mode', icon: 'Shield', moduleId: 'marketing' },
      { label: 'Safe Mode OFF', prompt: 'desativar safe mode', icon: 'ShieldOff', moduleId: 'marketing' },
      { label: 'Sentinel Scan', prompt: 'rodar sentinel', icon: 'Radar', moduleId: 'marketing' },
      { label: 'Leads & Funil', prompt: 'Como estao os leads e o funil de vendas?', icon: 'Users', moduleId: 'marketing' },
      { label: 'Estrategia', prompt: 'Qual a estrategia atual e recomendacoes?', icon: 'Target', moduleId: 'marketing' },
    ];
  }

  async getProactiveAlerts(_userId: string): Promise<ModuleAlert[]> {
    const alerts: ModuleAlert[] = [];

    try {
      const pendingCount = await prisma.scheduledPost.count({ where: { status: 'PENDING' } });
      if (pendingCount > 10) {
        alerts.push({
          id: 'marketing-queue-high',
          moduleId: 'marketing',
          title: 'Fila de posts alta',
          message: `${pendingCount} posts pendentes na fila.`,
          severity: 'warning',
          createdAt: new Date(),
        });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const publishedToday = await prisma.scheduledPost.count({
        where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } },
      });
      if (publishedToday === 0 && new Date().getHours() >= 12) {
        alerts.push({
          id: 'marketing-no-posts-today',
          moduleId: 'marketing',
          title: 'Sem posts hoje',
          message: 'Nenhum post publicado hoje ainda. Considere publicar agora.',
          severity: 'info',
          createdAt: new Date(),
        });
      }
    } catch {}

    return alerts;
  }
}

// ─── Dashboard & Inventory (absorbed from Orion/ai-chat) ───

let agentCountCache = 0;
let agentCountCacheTs = 0;

async function getAgentCount(): Promise<number> {
  const now = Date.now();
  if (agentCountCache > 0 && now - agentCountCacheTs < 60_000) return agentCountCache;
  try {
    agentCountCache = await prisma.agent.count();
    agentCountCacheTs = now;
  } catch {
    agentCountCache = 39;
  }
  return agentCountCache;
}

let cachedDashContext: any = null;
let dashCacheTs = 0;
const DASH_CACHE_TTL = 60_000;

async function gatherDashboardContext() {
  const now = Date.now();
  if (cachedDashContext && now - dashCacheTs < DASH_CACHE_TTL) return cachedDashContext;

  const oneDayAgo = new Date(Date.now() - 86400000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const results = await Promise.allSettled([
    Promise.all([
      prisma.systemConfig.findFirst({ where: { key: 'safe_mode' } }).catch(() => null),
      prisma.agentLog.count({ where: { createdAt: { gte: oneDayAgo } } }).catch(() => 0),
    ]),
    Promise.all([
      prisma.scheduledPost.count({ where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } } }).catch(() => 0),
      prisma.scheduledPost.count({ where: { status: 'PENDING' } }).catch(() => 0),
    ]),
    prisma.lead.groupBy({ by: ['stage'], _count: true }).catch(() => []),
    Promise.all([
      prisma.adCampaign.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      prisma.campaign.count().catch(() => 0),
    ]),
    prisma.offer.aggregate({ _sum: { revenue: true } }).catch(() => ({ _sum: { revenue: null } })),
  ]);

  const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value : null;

  cachedDashContext = {
    safeMode: val(0)?.[0]?.value ?? 'off',
    agentActions24h: val(0)?.[1] ?? 0,
    postsPublishedToday: val(1)?.[0] ?? 0,
    postsPending: val(1)?.[1] ?? 0,
    leadsByStage: val(2) ?? [],
    activeAdCampaigns: val(3)?.[0] ?? 0,
    totalCampaigns: val(3)?.[1] ?? 0,
    totalRevenue: val(4)?._sum?.revenue ?? 0,
  };
  dashCacheTs = now;
  return cachedDashContext;
}

export async function getAgentInventory() {
  try {
    const agents = await prisma.agent.findMany({ orderBy: { name: 'asc' } });
    return agents.map((a) => ({
      name: a.name,
      function: a.function,
      specialty: a.description,
      schedule: a.cronExpression || 'on-demand',
      autonomyLevel: a.autonomyLevel >= 5 ? 'full' : a.autonomyLevel >= 3 ? 'supervised' : 'interactive',
      lastRun: a.lastRunAt?.toISOString() || null,
      status: a.status,
    }));
  } catch {
    return [];
  }
}

export async function getDashboardData() {
  const ctx = await gatherDashboardContext();
  const totalLeads = (ctx.leadsByStage as any[]).reduce((s: number, g: any) => s + (g._count || 0), 0);

  return {
    totalAgents: await getAgentCount(),
    postsToday: ctx.postsPublishedToday,
    totalLeads,
    activeCampaigns: ctx.activeAdCampaigns + ctx.totalCampaigns,
    safeMode: ctx.safeMode,
    agentActions24h: ctx.agentActions24h,
    postsPending: ctx.postsPending,
    totalRevenue: ctx.totalRevenue,
  };
}
