import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth';
import { sendMessage, getInventory, getDashboard } from './ai-chat.controller';

const router = Router();

// AI chat uses LLM on every message — rate limit to prevent cost abuse
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 messages per 15 min per IP
  message: { success: false, message: 'Too many chat messages. Try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/message', authMiddleware, chatLimiter, sendMessage);
router.get('/inventory', authMiddleware, getInventory);
router.get('/dashboard', authMiddleware, getDashboard);

export default router;
