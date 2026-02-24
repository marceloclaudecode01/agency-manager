import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error-handler';

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
import { startAllAgents } from './agents/scheduler.agent';

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startAllAgents();
});

export default app;
