import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth';
import { sendMessage, getModules, getQuickActions, getAlerts, getBriefing, getDashboard, getInventory, getHistory } from './easyorios.controller';

const router = Router();

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many messages. Try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/message', authMiddleware, chatLimiter, sendMessage);
router.get('/modules', authMiddleware, getModules);
router.get('/quick-actions', authMiddleware, getQuickActions);
router.get('/alerts', authMiddleware, getAlerts);
router.get('/briefing', authMiddleware, getBriefing);
router.get('/dashboard', authMiddleware, getDashboard);
router.get('/inventory', authMiddleware, getInventory);
router.get('/history', authMiddleware, getHistory);

export default router;
