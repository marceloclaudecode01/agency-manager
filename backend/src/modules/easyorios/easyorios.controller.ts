import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ApiResponse } from '../../utils/api-response';
import { getEasyoriosResponse, getModulesInfo, getConversationHistory } from './easyorios-brain.service';
import { registry } from './core/module-registry';
import { getAgentInventory, getDashboardData } from './modules/marketing.module';
import prisma from '../../config/database';
import { generatePostsForClient } from '../../agents/scheduler.agent';
import { agentLog } from '../../agents/agent-logger';

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return ApiResponse.badRequest(res, 'Mensagem e obrigatoria');
    }

    const result = await getEasyoriosResponse(
      message.trim(),
      history || [],
      req.user?.id || '',
      req.user?.role,
    );

    return ApiResponse.success(res, {
      response: result.response,
      commandExecuted: result.commandResult || null,
    }, 'Resposta gerada com sucesso');
  } catch (error: any) {
    console.error('[Easyorios] Error:', error.message);
    return ApiResponse.success(res, {
      response: 'Erro temporario. Tente novamente em alguns segundos.',
      commandExecuted: null,
    }, 'Fallback response');
  }
}

export async function getModules(_req: AuthRequest, res: Response) {
  try {
    const modules = await getModulesInfo();
    return ApiResponse.success(res, { modules });
  } catch (error: any) {
    console.error('[Easyorios] Modules error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar modulos');
  }
}

export async function getQuickActions(req: AuthRequest, res: Response) {
  try {
    const actions = await registry.getAllQuickActions(req.user?.id || '');
    return ApiResponse.success(res, { actions });
  } catch (error: any) {
    console.error('[Easyorios] QuickActions error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar quick actions');
  }
}

export async function getAlerts(req: AuthRequest, res: Response) {
  try {
    const alerts = await registry.getAllAlerts(req.user?.id || '');
    return ApiResponse.success(res, { alerts });
  } catch (error: any) {
    console.error('[Easyorios] Alerts error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar alertas');
  }
}

export async function getBriefing(req: AuthRequest, res: Response) {
  try {
    const [contexts, alerts] = await Promise.all([
      registry.gatherAllContext(req.user?.id || ''),
      registry.getAllAlerts(req.user?.id || ''),
    ]);

    return ApiResponse.success(res, {
      contexts,
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Easyorios] Briefing error:', error.message);
    return ApiResponse.error(res, 'Erro ao gerar briefing');
  }
}

export async function getDashboard(_req: AuthRequest, res: Response) {
  try {
    const data = await getDashboardData();
    return ApiResponse.success(res, data);
  } catch (error: any) {
    console.error('[Easyorios] Dashboard error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar dashboard');
  }
}

export async function getHistory(req: AuthRequest, res: Response) {
  try {
    const messages = await getConversationHistory(req.user?.id || '', 50);
    return ApiResponse.success(res, { messages });
  } catch (error: any) {
    console.error('[Easyorios] History error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar historico');
  }
}

export async function triggerEngine(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return ApiResponse.forbidden(res, 'Apenas admins podem disparar o motor');
    }

    await agentLog('Autonomous Engine', '🔧 Motor disparado manualmente via API', { type: 'action' });

    const activeClients = await prisma.client.findMany({
      where: { isActive: true, status: 'ACTIVE' },
      select: { id: true, name: true, niche: true, notes: true, facebookPageName: true, facebookPageId: true, facebookAccessToken: true },
    });

    let totalScheduled = 0;
    const clientSummaries: string[] = [];

    if (activeClients.length === 0) {
      const ids = await generatePostsForClient();
      totalScheduled = ids.length;
      clientSummaries.push(`Default: ${ids.length} posts`);
    } else {
      for (const client of activeClients) {
        try {
          const hasOwnPage = client.facebookPageId && client.facebookAccessToken;
          const hasEnvFallback = process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_ACCESS_TOKEN;
          if (!hasOwnPage && !hasEnvFallback) {
            clientSummaries.push(`${client.name}: sem config`);
            continue;
          }

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
          clientSummaries.push(`${client.name}: ERRO - ${clientErr.message.substring(0, 80)}`);
        }
      }
    }

    await agentLog('Autonomous Engine', `✅ Motor manual concluído. ${totalScheduled} posts agendados. ${clientSummaries.join(' | ')}`, { type: 'result' });

    return ApiResponse.success(res, {
      totalScheduled,
      clients: clientSummaries,
    }, `Motor executado: ${totalScheduled} posts agendados`);
  } catch (error: any) {
    console.error('[Engine] Manual trigger error:', error.message);
    return ApiResponse.error(res, `Erro ao disparar motor: ${error.message}`);
  }
}

export async function getInventory(_req: AuthRequest, res: Response) {
  try {
    const agents = await getAgentInventory();
    return ApiResponse.success(res, { agents });
  } catch (error: any) {
    console.error('[Easyorios] Inventory error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar inventario');
  }
}
