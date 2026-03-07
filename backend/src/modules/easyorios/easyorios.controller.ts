import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ApiResponse } from '../../utils/api-response';
import { getEasyoriosResponse, getModulesInfo, getConversationHistory } from './easyorios-brain.service';
import { registry } from './core/module-registry';
import { getAgentInventory, getDashboardData } from './modules/marketing.module';

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

export async function getInventory(_req: AuthRequest, res: Response) {
  try {
    const agents = await getAgentInventory();
    return ApiResponse.success(res, { agents });
  } catch (error: any) {
    console.error('[Easyorios] Inventory error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar inventario');
  }
}
