import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ApiResponse } from '../../utils/api-response';
import { getOrionResponse, getAgentInventory, getDashboardData } from './ai-chat.service';

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return ApiResponse.badRequest(res, 'Mensagem é obrigatória');
    }

    const result = await getOrionResponse(message.trim(), history || []);

    return ApiResponse.success(res, {
      response: result.response,
      commandExecuted: result.commandResult || null,
    }, 'Resposta gerada com sucesso');
  } catch (error: any) {
    console.error('[AI Chat] Error:', error.message);
    // Return a user-friendly response instead of 500
    return ApiResponse.success(res, {
      response: `⚠️ Erro temporário: ${error.message?.includes('GROQ_API_KEY') ? 'Chave de API não configurada. Configure GROQ_API_KEY nas variáveis de ambiente do Railway.' : 'Não consegui processar sua mensagem. Tente novamente em alguns segundos.'}`,
      commandExecuted: null,
    }, 'Fallback response');
  }
}

export async function getInventory(_req: AuthRequest, res: Response) {
  try {
    const inventory = await getAgentInventory();
    return ApiResponse.success(res, { agents: inventory });
  } catch (error: any) {
    console.error('[AI Chat] Inventory error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar inventário de agentes');
  }
}

export async function getDashboard(_req: AuthRequest, res: Response) {
  try {
    const dashboard = await getDashboardData();
    return ApiResponse.success(res, dashboard);
  } catch (error: any) {
    console.error('[AI Chat] Dashboard error:', error.message);
    return ApiResponse.error(res, 'Erro ao carregar dashboard');
  }
}
