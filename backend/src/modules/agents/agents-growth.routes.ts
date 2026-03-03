import { Router } from 'express';
import { AgentsGrowthController } from './agents-growth.controller';
import { authMiddleware, requireRole } from '../../middlewares/auth';

const router = Router();
const controller = new AgentsGrowthController();

router.use(authMiddleware);

// Epic 3: Leads / CRM
router.get('/leads', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.getLeads(req as any, res));
router.get('/leads/pipeline', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.getLeadPipelineEndpoint(req as any, res));
router.post('/leads', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.createLead(req as any, res));
router.patch('/leads/:id', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.updateLead(req as any, res));
router.patch('/leads/:id/stage', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.moveLeadStage(req as any, res));
router.post('/leads/:id/interactions', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.addInteraction(req as any, res));
router.post('/leads/scan', requireRole('ADMIN'), (req, res) => controller.scanLeadsNow(req as any, res));

// Epic 5: Strategic Command
router.get('/strategic-plan', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.getStrategicPlan(req as any, res));
router.post('/strategic-plan/generate', requireRole('ADMIN'), (req, res) => controller.generatePlanNow(req as any, res));

// Epic 7: Niche Learning
router.get('/audience', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.getAudienceInsights(req as any, res));
router.post('/audience/learn', requireRole('ADMIN'), (req, res) => controller.learnNow(req as any, res));

// Epic 9: Compliance + Variation
router.get('/compliance/stats', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.getComplianceStatsEndpoint(req as any, res));
router.post('/compliance/check', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.checkComplianceEndpoint(req as any, res));
router.get('/variation/stats', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.getVariationStatsEndpoint(req as any, res));

export default router;
