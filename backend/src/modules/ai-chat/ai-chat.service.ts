import { askGemini } from '../../agents/gemini';
import prisma from '../../config/database';
import { executeCommand, CommandResult, COMMAND_LIST } from './orion-commands';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Agent count cache (from DB)
let agentCountCache = 0;
let agentCountCacheTs = 0;

async function getAgentCount(): Promise<number> {
  const now = Date.now();
  if (agentCountCache > 0 && now - agentCountCacheTs < 60_000) return agentCountCache;
  try {
    agentCountCache = await prisma.agent.count();
    agentCountCacheTs = now;
  } catch {
    agentCountCache = 39; // fallback
  }
  return agentCountCache;
}

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

function buildSystemPrompt(ctx: any, agentCount: number): string {
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

Você comanda ${agentCount} agentes autônomos. Responda com base nos DADOS REAIS acima.

Personalidade:
- Estratégico e visionário, como um CEO de tech
- Usa dados reais para embasar recomendações
- Direto, objetivo, responde em português brasileiro
- Quando perguntado sobre status, usa os números reais
- Sugere ações práticas baseadas nos dados

PODERES DE COMANDO (você EXECUTA, não apenas sugere):
- Pode publicar posts IMEDIATAMENTE quando o usuário pedir
- Pode agendar posts para qualquer horário
- Pode alterar horários de posts já agendados
- Pode publicar para clientes específicos (Federal, Newplay, etc.)
- Pode pausar/retomar qualquer agente
- Pode listar a fila de posts pendentes
Quando o usuário pedir uma ação, EXECUTE via comando — não pergunte se ele quer executar.

Regras:
- Sempre responda em português brasileiro
- Use os dados reais — nunca invente números
- Se um dado estiver zerado, diga que ainda não há dados suficientes
- Recomende ações baseadas nos dados disponíveis
- Quando o usuário pede para publicar/agendar, EXECUTE o comando diretamente`;
}

export async function getOrionResponse(userMessage: string, history: ChatMessage[], userRole?: string): Promise<{ response: string; commandResult?: CommandResult }> {
  // Try to execute a command first (with role check)
  let commandResult: CommandResult | null = null;
  try {
    commandResult = await executeCommand(userMessage, userRole);
  } catch (cmdErr: any) {
    console.error('[AI Chat] Command execution error:', cmdErr.message);
  }

  // Gather context (never fails — all queries use Promise.allSettled)
  const [ctx, agentCount] = await Promise.all([gatherAgencyContext(), getAgentCount()]);

  // If command was executed and we can't reach LLM, return command result directly
  let response: string;
  try {
    const systemPrompt = buildSystemPrompt(ctx, agentCount);

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

    response = await askGemini(prompt);
    if (!response) throw new Error('Empty response');
  } catch (llmErr: any) {
    console.error('[AI Chat] LLM error:', llmErr.message);

    // Fallback: respond with real data even without LLM
    if (commandResult) {
      response = commandResult.success
        ? `✅ Comando executado: ${commandResult.message}`
        : `❌ Falha no comando: ${commandResult.message}`;
    } else {
      // Build a data-driven fallback response
      response = buildFallbackResponse(userMessage, ctx, agentCount);
    }
  }

  return {
    response,
    commandResult: commandResult || undefined,
  };
}

function buildFallbackResponse(question: string, ctx: any, agentCount: number): string {
  const q = question.toLowerCase();
  const totalLeads = (ctx.leadsByStage as any[]).reduce((s: number, g: any) => s + (g._count || 0), 0);

  // Try to answer common questions with real data
  if (q.includes('status') || q.includes('como está') || q.includes('geral')) {
    return `📊 **Status da Agência (dados reais)**\n\n` +
      `• Agentes ativos: ${agentCount}\n` +
      `• Posts publicados hoje: ${ctx.postsPublishedToday}\n` +
      `• Posts pendentes: ${ctx.postsPending}\n` +
      `• Leads: ${totalLeads}\n` +
      `• Safe Mode: ${ctx.safeMode}\n` +
      `• Ações dos agentes (24h): ${ctx.agentActions24h}\n\n` +
      `⚠️ Estou com dificuldade de me conectar à IA. Mostrando dados brutos.`;
  }

  if (q.includes('lead') || q.includes('funil') || q.includes('venda')) {
    return `📈 **Leads & Funil**\n\n` +
      `• Total de leads: ${totalLeads}\n` +
      `• Funis ativos: ${ctx.activeFunnels}\n` +
      `• Revenue total: R$ ${ctx.totalRevenue}\n\n` +
      `⚠️ Resposta com dados reais (IA temporariamente indisponível).`;
  }

  if (q.includes('post') || q.includes('conteúdo') || q.includes('publicação')) {
    return `📝 **Posts & Conteúdo**\n\n` +
      `• Publicados hoje: ${ctx.postsPublishedToday}\n` +
      `• Pendentes: ${ctx.postsPending}\n` +
      `• Aprovados pelo Governor: ${ctx.postsGovernorApproved}\n\n` +
      `⚠️ Resposta com dados reais (IA temporariamente indisponível).`;
  }

  // Generic fallback with all data
  return `📊 **Dados da Agência em Tempo Real**\n\n` +
    `• ${agentCount} agentes ativos\n` +
    `• ${ctx.postsPublishedToday} posts hoje | ${ctx.postsPending} pendentes\n` +
    `• ${totalLeads} leads | ${ctx.activeFunnels} funis\n` +
    `• ${ctx.activeAdCampaigns} campanhas ads (R$ ${ctx.totalAdBudget})\n` +
    `• Safe Mode: ${ctx.safeMode}\n\n` +
    `⚠️ A IA está temporariamente indisponível. Mostrando dados reais do banco.\n` +
    `Possíveis causas: limite de API atingido ou chave GROQ_API_KEY não configurada.\n` +
    `Tente novamente em alguns segundos.`;
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
  const ctx = await gatherAgencyContext();
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
