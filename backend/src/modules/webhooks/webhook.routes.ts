import { Router } from 'express';
import { handleComfyDeployWebhook } from './webhook.controller';

const router = Router();

// No auth middleware — external callback from ComfyDeploy
router.post('/comfydeploy', handleComfyDeployWebhook);

export default router;
