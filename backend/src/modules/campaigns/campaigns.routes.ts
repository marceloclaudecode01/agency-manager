import { Router } from 'express';
import { CampaignsController } from './campaigns.controller';
import { validate } from '../../middlewares/validate';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import { createCampaignSchema, updateCampaignSchema } from './campaigns.schema';

const router = Router();
const controller = new CampaignsController();

router.use(authMiddleware);

router.get('/', (req, res) => controller.findAll(req, res));
router.get('/:id', (req, res) => controller.findById(req, res));
router.post('/', requireRole('ADMIN', 'MANAGER'), validate(createCampaignSchema), (req, res) => controller.create(req, res));
router.put('/:id', requireRole('ADMIN', 'MANAGER'), validate(updateCampaignSchema), (req, res) => controller.update(req, res));
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), (req, res) => controller.delete(req, res));

export default router;
