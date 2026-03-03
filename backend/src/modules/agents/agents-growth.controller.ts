import { Response } from 'express';
import { AuthRequest } from '../../types';
import { ApiResponse } from '../../utils/api-response';
import prisma from '../../config/database';
import { scanForLeads, getLeadPipeline, updateLeadStage, addLeadInteraction } from '../../agents/lead-capture.agent';
import { generateStrategicPlan, getCurrentPlan } from '../../agents/strategic-command.agent';
import { learnFromAudience, getAudienceProfile } from '../../agents/niche-learning.agent';
import { checkCompliance, getComplianceStats } from '../../agents/policy-compliance.agent';
import { getVariationStats } from '../../agents/pattern-variation.agent';

export class AgentsGrowthController {
  // ═══════════════════════════════════════════════════════════
  // EPIC 3: LEADS / CRM
  // ═══════════════════════════════════════════════════════════

  async getLeads(req: AuthRequest, res: Response) {
    try {
      const { stage } = req.query as { stage?: string };
      const where: any = {};
      if (stage) where.stage = stage;
      const leads = await prisma.lead.findMany({
        where,
        orderBy: { score: 'desc' },
        include: { interactions: { take: 3, orderBy: { createdAt: 'desc' } } },
      });
      return ApiResponse.success(res, leads);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async getLeadPipelineEndpoint(_req: AuthRequest, res: Response) {
    try {
      const pipeline = await getLeadPipeline();
      return ApiResponse.success(res, pipeline);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async createLead(req: AuthRequest, res: Response) {
    try {
      const lead = await prisma.lead.create({ data: { ...req.body, source: req.body.source || 'manual' } });
      return ApiResponse.created(res, lead, 'Lead criado');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async updateLead(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const lead = await prisma.lead.update({ where: { id }, data: req.body });
      return ApiResponse.success(res, lead, 'Lead atualizado');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async moveLeadStage(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { stage } = req.body;
      const lead = await updateLeadStage(id, stage);
      return ApiResponse.success(res, lead, `Lead movido para ${stage}`);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async addInteraction(req: AuthRequest, res: Response) {
    try {
      const leadId = req.params.id as string;
      const { type, content, direction } = req.body;
      const interaction = await addLeadInteraction(leadId, type, content, direction);
      return ApiResponse.created(res, interaction, 'Interação registrada');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async scanLeadsNow(_req: AuthRequest, res: Response) {
    try {
      const result = await scanForLeads();
      return ApiResponse.success(res, result, `${result.created} leads capturados`);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EPIC 5: STRATEGIC COMMAND
  // ═══════════════════════════════════════════════════════════

  async getStrategicPlan(_req: AuthRequest, res: Response) {
    try {
      const plan = await getCurrentPlan();
      return ApiResponse.success(res, plan);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async generatePlanNow(_req: AuthRequest, res: Response) {
    try {
      const plan = await generateStrategicPlan();
      return ApiResponse.success(res, plan, 'Plano estratégico gerado');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EPIC 7: NICHE LEARNING
  // ═══════════════════════════════════════════════════════════

  async getAudienceInsights(_req: AuthRequest, res: Response) {
    try {
      const profile = await getAudienceProfile();
      return ApiResponse.success(res, profile);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async learnNow(_req: AuthRequest, res: Response) {
    try {
      const result = await learnFromAudience();
      return ApiResponse.success(res, result, 'Aprendizado concluído');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EPIC 9: COMPLIANCE + VARIATION STATS
  // ═══════════════════════════════════════════════════════════

  async getComplianceStatsEndpoint(_req: AuthRequest, res: Response) {
    try {
      const stats = await getComplianceStats();
      return ApiResponse.success(res, stats);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async checkComplianceEndpoint(req: AuthRequest, res: Response) {
    try {
      const { message, platform } = req.body;
      if (!message) return ApiResponse.error(res, 'message é obrigatório', 400);
      const result = await checkCompliance(message, platform);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  async getVariationStatsEndpoint(_req: AuthRequest, res: Response) {
    try {
      const stats = await getVariationStats();
      return ApiResponse.success(res, stats);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
