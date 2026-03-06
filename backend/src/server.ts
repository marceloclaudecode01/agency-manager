import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { errorHandler } from './middlewares/error-handler';
import prisma from './config/database';

import authRoutes from './modules/auth/auth.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import clientsRoutes from './modules/clients/clients.routes';
import campaignsRoutes from './modules/campaigns/campaigns.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import financeRoutes from './modules/finance/finance.routes';
import reportsRoutes from './modules/reports/reports.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import usersRoutes from './modules/users/users.routes';
import socialRoutes from './modules/social/social.routes';
import agentsRoutes from './modules/agents/agents.routes';
import agentsGrowthRoutes from './modules/agents/agents-growth.routes';
import productsRoutes from './modules/products/products.routes';
import chatRoutes from './modules/chat/chat.routes';
import aiChatRoutes from './modules/ai-chat/ai-chat.routes';
import easyoriosRoutes from './modules/easyorios/easyorios.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import { startAllAgents } from './agents/scheduler.agent';
import { setAgentLoggerIo } from './agents/agent-logger';
import { bootstrapEasyorios } from './modules/easyorios/core/bootstrap';
import { startProactiveEngine } from './modules/easyorios/core/proactive-engine';

console.log('[Boot] Modules imported successfully');

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}

const JWT_SECRET = process.env.JWT_SECRET;
const app = express();
const PORT = process.env.PORT || 3333;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.set('trust proxy', 1);
app.use(helmet());
const IS_PROD = process.env.NODE_ENV === 'production';
const CORS_ORIGINS = IS_PROD
  ? [FRONTEND_URL]
  : [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'];
app.use(cors({
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Webhook routes — BEFORE CSRF (external callbacks have no Origin header)
import webhookRoutes from './modules/webhooks/webhook.routes';
app.use('/api/webhooks', webhookRoutes);

// CSRF protection: validate Origin header on mutating requests in production
const ALLOWED_ORIGINS = new Set(CORS_ORIGINS);
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ success: false, message: 'Forbidden: invalid origin' });
  }
  next();
});

// Rate limit geral
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/agents/growth', agentsGrowthRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/easyorios', easyoriosRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.1.0' });
});


// Error handler
app.use(errorHandler);

// HTTP server + Socket.io
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io auth middleware — reads from cookie (primary) or handshake.auth (fallback)
io.use((socket, next) => {
  // Parse cookies from handshake headers
  const cookieHeader = socket.handshake.headers.cookie || '';
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(c => {
    const [key, ...val] = c.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });

  const token = cookies['token'] || socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Socket.io events
io.on('connection', (socket) => {
  const userId = socket.data.user.id;
  socket.join(`user:${userId}`);

  socket.on('chat:message', async ({ receiverId, content }: { receiverId: string; content: string }) => {
    if (!content || typeof content !== 'string' || content.trim().length === 0) return;
    if (content.length > 5000) return;
    if (!receiverId || typeof receiverId !== 'string') return;
    if (receiverId === userId) return;

    try {
      const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } });
      if (!receiver) return;

      const msg = await prisma.message.create({
        data: { content: content.trim(), senderId: userId, receiverId },
        include: { sender: { select: { id: true, name: true, avatar: true } } },
      });
      io.to(`user:${receiverId}`).emit('chat:message', msg);
      io.to(`user:${userId}`).emit('chat:message', msg);
    } catch (err) {
      console.error('[Socket] chat:message error:', err);
    }
  });

  socket.on('disconnect', () => {});
});

console.log('[Boot] About to listen on port', PORT);
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  setAgentLoggerIo(io);
  bootstrapEasyorios();
  startProactiveEngine(io);
  startAllAgents();
});

export default app;
