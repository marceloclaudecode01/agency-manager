import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth';
import { sendMessage } from './ai-chat.controller';

const router = Router();

router.post('/message', authMiddleware, sendMessage);

export default router;
