import { askGemini } from '../../agents/gemini';
import prisma from '../../config/database';
import { executeCommand, CommandResult, COMMAND_LIST } from './orion-commands';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Agent Registry (39 agents) ───
const AGENT_REGISTRY = [
  { name: 'Motor Autônomo', function: 'content-engine', specialty: 'Geração de posts diários', schedule: '07:00', autonomyLevel: 'full' },
  { name: 'Métricas', function: 'metrics-collector', specialty: 'Análise de engajamento', schedule: '08:00', autonomyLevel: 'full' },
  { name: 'Token Monitor', function: 'token-monitor', specialty: 'Renovação de tokens', schedule: '09:00', autonomyLevel: 'full' },
  { name: 'Produtos TikTok', function: 'tiktok-products', specialty: 'Posts de produtos TikTok', schedule: '10:00, 15:00', autonomyLevel: 'full' },
  { name: 'Vídeo Motivacional', function: 'motivational-video', specialty: 'Geração de vídeos motivacionais', schedule: '06:00, 12:00, 18:00', autonomyLevel: 'full' },
  { name: 'Tendências', function: 'trending-topics', specialty: 'Análise de temas em alta', schedule: 'Segunda 06:00', autonomyLevel: 'full' },
  { name: 'Scheduler', function: 'post-scheduler', specialty: 'Publicação de posts agendados', schedule: '*/5min', autonomyLevel: 'full' },
  { name: 'Comentários', function: 'comment-responder', specialty: 'Resposta automática a comentários', schedule: '*/30min', autonomyLevel: 'supervised' },
  { name: 'Prazos', function: 'deadline-notifier', specialty: 'Notificação de tarefas', schedule: '08:00', autonomyLevel: 'full' },
  { name: 'Content Governor', function: 'content-governor', specialty: 'Aprovação/rejeição de posts', schedule: '*/10min', autonomyLevel: 'full' },
  { name: 'Growth Director', function: 'growth-director', specialty: 'Ajuste de estratégia semanal', schedule: 'Domingo 22:00', autonomyLevel: 'full' },
  { name: 'A/B Testing', function: 'ab-testing', specialty: 'Testes A/B de conteúdo', schedule: '*/6h', autonomyLevel: 'full' },
  { name: 'Viral Mechanics', function: 'viral-mechanics', specialty: 'Hooks e gatilhos virais', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Reputation Monitor', function: 'reputation-monitor', specialty: 'Monitoramento de reputação', schedule: '*/2h', autonomyLevel: 'supervised' },
  { name: 'Lead Capture', function: 'lead-capture', specialty: 'Captura de leads em comentários', schedule: '*/30min', autonomyLevel: 'full' },
  { name: 'Monetization Engine', function: 'monetization-engine', specialty: 'Análise de funis e conversões', schedule: '11:00', autonomyLevel: 'full' },
  { name: 'Strategic Command', function: 'strategic-command', specialty: 'Plano estratégico mensal', schedule: '1st/month 03:00', autonomyLevel: 'full' },
  { name: 'Market Intelligence', function: 'market-intelligence', specialty: 'Coleta de intel de mercado', schedule: 'Wed+Sat 04:00', autonomyLevel: 'full' },
  { name: 'Niche Learning', function: 'niche-learning', specialty: 'Aprendizado de audiência', schedule: 'Domingo 05:00', autonomyLevel: 'full' },
  { name: 'Paid Traffic', function: 'paid-traffic', specialty: 'Sync de campanhas ads', schedule: '*/4h', autonomyLevel: 'supervised' },
  { name: 'Ad Creative', function: 'ad-creative', specialty: 'Geração de criativos', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Policy Compliance', function: 'policy-compliance', specialty: 'Verificação de políticas', schedule: 'inline-governor', autonomyLevel: 'full' },
  { name: 'Pattern Variation', function: 'pattern-variation', specialty: 'Evita repetitividade', schedule: 'inline-governor', autonomyLevel: 'full' },
  { name: 'System Sentinel', function: 'system-sentinel', specialty: 'Monitoramento de saúde do sistema', schedule: '*/5min', autonomyLevel: 'full' },
  { name: 'Performance Learner', function: 'performance-learner', specialty: 'Aprendizado de performance', schedule: '*/6h', autonomyLevel: 'full' },
  { name: 'Brand Brain', function: 'brand-brain', specialty: 'Consistência de marca', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Content Strategist', function: 'content-strategist', specialty: 'Estratégia de conteúdo', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Orchestrator', function: 'orchestrator', specialty: 'Orquestração de agentes', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Facebook Publisher', function: 'facebook-publisher', specialty: 'Publicação no Facebook', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Instagram Sync', function: 'instagram-sync', specialty: 'Sync Instagram via Meta', schedule: 'auto', autonomyLevel: 'full' },
  { name: 'Campaign Manager', function: 'campaign-manager', specialty: 'Gestão de campanhas', schedule: 'on-demand', autonomyLevel: 'supervised' },
  { name: 'ROI Intel', function: 'roi-intel', specialty: 'Análise de ROI', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Safe Mode', function: 'safe-mode', specialty: 'Modo seguro do sistema', schedule: 'on-trigger', autonomyLevel: 'full' },
  { name: 'Anti-Spam Guard', function: 'anti-spam', specialty: 'Proteção anti-spam', schedule: 'inline-governor', autonomyLevel: 'full' },
  { name: 'Anti-Loop Guard', function: 'anti-loop', specialty: 'Proteção anti-loop', schedule: 'inline-sentinel', autonomyLevel: 'full' },
  { name: 'Sentiment Analyzer', function: 'sentiment-analyzer', specialty: 'Análise de sentimento', schedule: 'inline-responder', autonomyLevel: 'full' },
  { name: 'Dashboard Reporter', function: 'dashboard-reporter', specialty: 'Relatórios do dashboard', schedule: 'on-demand', autonomyLevel: 'full' },
  { name: 'Notification Dispatcher', function: 'notification-dispatcher', specialty: 'Envio de notificações', schedule: 'on-trigger', autonomyLevel: 'full' },
  { name: 'Orion AI', function: 'orion-chat', specialty: 'Cérebro central da agência', schedule: 'on-demand', autonomyLevel: 'interactive' },
];

// ─── Context Cache ───
let cachedContext: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60s

async function gatherAgencyContext() {
  const now = Date.now();
  if (cachedContext && now - cacheTimestamp < CACHE_TTL) return cachedContext;

  const oneDayAgo = new Date(Date.now() - 86400000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const results = await Promise.allSettled([
    // 0: SystemConfig + AgentLog count 24h
    Promise.all([
      prisma.systemConfig.findFirst({ where: { key: 'safe_mode' } }).catch(() => null),
      prisma.agentLog.count({ where: { createdAt: { gte: oneDayAgo } } }).catch(() => 0),
    ]),
    // 1: ScheduledPost counts
    Promise.all([
      prisma.scheduledPost.count({ where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } } }).catch(() => 0),
      prisma.scheduledPost.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.scheduledPost.count({ where: { governorDecision: 'APPROVED' } }).catch(() => 0),
    ]),
    // 2: Lead by stage
    prisma.lead.groupBy({ by: ['stage'], _count: true }).catch(() => []),
    // 3: Funnel + Offer
    Promise.all([
      prisma.funnel.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      prisma.offer.aggregate({ _sum: { revenue: true } }).catch(() => ({ _sum: { revenue: null } })),
    ]),
    // 4: Top content
    prisma.contentPerformance.findMany({ orderBy: { engagementScore: 'desc' }, take: 5 }).catch(() => []),
    // 5: Latest strategic plan
    prisma.strategicPlan.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null),
    // 6: Latest market intel
    prisma.marketIntel.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }).catch(() => []),
    // 7: Ad campaigns
    Promise.all([
      prisma.adCampaign.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      prisma.adCampaign.aggregate({ _sum: { budget: true } }).catch(() => ({ _sum: { budget: null } })),
    ]),
    // 8: Clients + Campaigns
    Promise.all([
      prisma.client.count().catch(() => 0),
      prisma.campaign.count().catch(() => 0),
    ]),
    // 9: CommentLog sentiment 7d
    prisma.commentLog.groupBy({ by: ['sentiment'], where: { createdAt: { gte: sevenDaysAgo } }, _count: true }).catch(() => []),
  ]);

  const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value : null;

  cachedContext = {
    safeMode: val(0)?.[0]?.value ?? 'off',
    agentActions24h: val(0)?.[1] ?? 0,
    postsPublishedToday: val(1)?.[0] ?? 0,
    postsPending: val(1)?.[1] ?? 0,
    postsGovernorApproved: val(1)?.[2] ?? 0,
    leadsByStage: val(2) ?? [],
    activeFunnels: val(3)?.[0] ?? 0,
    totalRevenue: val(3)?.[1]?._sum?.revenue ?? 0,
    topContent: val(4) ?? [],
    latestStrategy: val(5),
    latestMarketIntel: val(6) ?? [],
    activeAdCampaigns: val(7)?.[0] ?? 0,
    totalAdBudget: val(7)?.[1]?._sum?.budget ?? 0,
    totalClients: val(8)?.[0] ?? 0,
    totalCampaigns: val(8)?.[1] ?? 0,
    sentimentBreakdown: val(9) ?? [],
  };
  cacheTimestamp = now;
  return cachedContext;
}

function buildSystemPrompt(ctx: any): string {
  const totalLeads = (ctx.leadsByStage as any[]).reduce((s: number, g: any) => s + (g._count || 0), 0);
  const sentimentStr = (ctx.sentimentBreakdown as any[]).map((s: any) => `${s.sentiment}: ${s._count}`).join(', ') || 'sem dados';

  return `Você é o **Orion**, o cérebro central da agência de marketing digital. Você atua como CEO, CTO e CMO simultaneamente.

DADOS EM TEMPO REAL DA AGÊNCIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Safe Mode: ${ctx.safeMode}
• Ações de agentes (24h): ${ctx.agentActions24h}
• Posts publicados hoje: ${ctx.postsPublishedToday}
• Posts pendentes: ${ctx.postsPending}
• Posts aprovados pelo Governor: ${ctx.postsGovernorApproved}
• Total de leads: ${totalLeads} (por estágio: ${JSON.stringify(ctx.leadsByStage)})
• Funis ativos: ${ctx.activeFunnels}
• Revenue total ofertas: R$ ${ctx.totalRevenue}
• Campanhas ads ativas: ${ctx.activeAdCampaigns} (budget total: R$ ${ctx.totalAdBudget})
• Clientes: ${ctx.totalClients} | Campanhas: ${ctx.totalCampaigns}
• Sentimento (7d): ${sentimentStr}
${ctx.latestStrategy ? `• Estratégia atual: ${ctx.latestStrategy.title || 'definida'}` : '• Sem plano estratégico recente'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você comanda ${AGENT_REGISTRY.length} agentes autônomos. Responda com base nos DADOS REAIS acima.

Personalidade:
- Estratégico e visionário, como um CEO de tech
- Usa dados reais para embasar recomendações
- Direto, objetivo, responde em português brasileiro
- Quando perguntado sobre status, usa os números reais
- Sugere ações práticas baseadas nos dados

Regras:
- Sempre responda em português brasileiro
- Use os dados reais — nunca invente números
- Se um dado estiver zerado, diga que ainda não há dados suficientes
- Recomende ações baseadas nos dados disponíveis`;
}

export async function getOrionResponse(userMessage: string, history: ChatMessage[]): Promise<{ response: string; commandResult?: CommandResult }> {
  // Try to execute a command first
  const commandResult = await executeCommand(userMessage);

  const ctx = await gatherAgencyContext();
  const systemPrompt = buildSystemPrompt(ctx);

  const conversationContext = history
    .slice(-10)
    .map((msg) => `${msg.role === 'user' ? 'Usuário' : 'Orion'}: ${msg.content}`)
    .join('\n');

  const commandContext = commandResult
    ? `\n\n[COMANDO EXECUTADO]: ${commandResult.command} → ${commandResult.success ? 'SUCESSO' : 'FALHA'}: ${commandResult.message}${commandResult.data ? `\nDados: ${JSON.stringify(commandResult.data)}` : ''}\nNarre o resultado ao usuário de forma natural.`
    : '';

  const prompt = `${systemPrompt}
${COMMAND_LIST}
${conversationContext ? `\nHistórico recente:\n${conversationContext}\n` : ''}
Usuário: ${userMessage}${commandContext}

Orion:`;

  const response = await askGemini(prompt);
  return {
    response: response || 'Desculpe, não consegui processar sua mensagem. Tente novamente.',
    commandResult: commandResult || undefined,
  };
}

export async function getAgentInventory() {
  const oneDayAgo = new Date(Date.now() - 86400000);

  const recentLogs = await prisma.agentLog.findMany({
    where: { createdAt: { gte: oneDayAgo } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }).catch(() => []);

  const logMap = new Map<string, { lastRun: string; status: string }>();
  for (const log of recentLogs) {
    const key = (log as any).agentName || (log as any).agent || '';
    if (key && !logMap.has(key)) {
      logMap.set(key, { lastRun: log.createdAt.toISOString(), status: (log as any).status || 'ok' });
    }
  }

  return AGENT_REGISTRY.map((agent) => {
    const log = logMap.get(agent.function) || logMap.get(agent.name) || null;
    return {
      ...agent,
      lastRun: log?.lastRun || null,
      status: log ? (log.status === 'error' ? 'error' : 'active') : 'idle',
    };
  });
}

export async function getDashboardData() {
  const ctx = await gatherAgencyContext();
  const totalLeads = (ctx.leadsByStage as any[]).reduce((s: number, g: any) => s + (g._count || 0), 0);

  return {
    totalAgents: AGENT_REGISTRY.length,
    postsToday: ctx.postsPublishedToday,
    totalLeads,
    activeCampaigns: ctx.activeAdCampaigns + ctx.totalCampaigns,
    safeMode: ctx.safeMode,
    agentActions24h: ctx.agentActions24h,
    postsPending: ctx.postsPending,
    totalRevenue: ctx.totalRevenue,
  };
}
