import { Router } from 'express';
import { handleComfyDeployWebhook } from './webhook.controller';
import { handleTelegramUpdate } from '../easyorios/services/telegram.service';

const router = Router();

// No auth middleware — external callback from ComfyDeploy
router.post('/comfydeploy', handleComfyDeployWebhook);

// No auth middleware — external callback from Telegram Bot API
router.post('/telegram', async (req, res) => {
  try {
    await handleTelegramUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('[Webhook] Telegram error:', e.message);
    res.status(200).json({ ok: true }); // Always 200 to avoid Telegram retries
  }
});

export default router;
