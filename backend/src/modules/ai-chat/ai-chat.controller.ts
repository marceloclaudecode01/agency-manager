import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ApiResponse } from '../../utils/api-response';
import { getOrionResponse } from './ai-chat.service';

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return ApiResponse.badRequest(res, 'Mensagem é obrigatória');
    }

    const response = await getOrionResponse(message.trim(), history || []);

    return ApiResponse.success(res, { response }, 'Resposta gerada com sucesso');
  } catch (error: any) {
    console.error('[AI Chat] Error:', error.message);
    return ApiResponse.error(res, 'Erro ao gerar resposta do Orion');
  }
}
