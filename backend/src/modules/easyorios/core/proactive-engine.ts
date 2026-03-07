import prisma from '../../../config/database';
import { registry } from './module-registry';
import { notificationsService } from '../../notifications/notifications.service';
import { sendTelegramMessage } from '../services/telegram.service';
import { checkScheduledActions } from './scheduler-engine';
import { evaluateRules } from './rules-engine';
import { startEvolutionMode, stopEvolutionMode } from './evolution-engine';

let briefingCache: { data: any; ts: number } | null = null;
const BRIEFING_TTL = 24 * 60 * 60 * 1000; // 24h

export async function checkProactiveAlerts(io?: any): Promise<void> {
  try {
    const users = await prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      const alerts = await registry.getAllAlerts(user.id);

      for (const alert of alerts) {
        // Check if this alert was already sent recently (last 4h)
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const existing = await prisma.easyoriosAlert.findFirst({
          where: {
            userId: user.id,
            moduleId: alert.moduleId,
            title: alert.title,
            createdAt: { gte: fourHoursAgo },
          },
        });

        if (!existing) {
          await prisma.easyoriosAlert.create({
            data: {
              userId: user.id,
              moduleId: alert.moduleId,
              title: alert.title,
              message: alert.message,
              severity: alert.severity,
            },
          });

          // Emit socket event if io is available
          if (io) {
            io.to(`user:${user.id}`).emit('easyorios:alert', alert);
          }
        }
      }
    }
  } catch (e: any) {
    console.error('[Easyorios Proactive] Error checking alerts:', e.message);
  }
}

export async function getDailyBriefing(userId: string): Promise<any> {
  const now = Date.now();
  if (briefingCache && now - briefingCache.ts < BRIEFING_TTL) {
    return briefingCache.data;
  }

  const contexts = await registry.gatherAllContext(userId);
  const alerts = await registry.getAllAlerts(userId);

  const briefing = {
    contexts,
    alerts,
    generatedAt: new Date().toISOString(),
  };

  briefingCache = { data: briefing, ts: now };
  return briefing;
}

// ── Reminder Notification Cron ──

async function checkDueReminders(io?: any): Promise<void> {
  try {
    const dueReminders = await prisma.reminder.findMany({
      where: {
        completed: false,
        notified: false,
        dueAt: { lte: new Date() },
      },
      take: 50,
    });

    for (const reminder of dueReminders) {
      // For recurring reminders: recalculate next dueAt instead of just marking notified
      if (reminder.recurring) {
        const nextDue = new Date(reminder.dueAt);
        if (reminder.recurring === 'daily') nextDue.setDate(nextDue.getDate() + 1);
        else if (reminder.recurring === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
        else if (reminder.recurring === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);

        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { dueAt: nextDue, notified: false },
        });
      } else {
        // Non-recurring: mark as notified
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { notified: true },
        });
      }

      const alertMsg = `Lembrete: ${reminder.title}`;

      // 1. Create persistent notification (socket emitted internally)
      try {
        await notificationsService.createAndEmit(
          reminder.userId,
          'REMINDER',
          'Lembrete',
          reminder.title,
        );
      } catch (e: any) {
        console.error('[Easyorios] Notification emit error:', e.message);
      }

      // 2. Emit Easyorios-specific alert via socket
      if (io) {
        io.to(`user:${reminder.userId}`).emit('easyorios:alert', {
          id: reminder.id,
          moduleId: 'personal',
          title: 'Lembrete',
          message: reminder.title,
          severity: 'warning',
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Send via Telegram if user has active channel
      try {
        const channel = await prisma.communicationChannel.findFirst({
          where: {
            userId: reminder.userId,
            platform: 'telegram',
            isActive: true,
          },
        });
        if (channel) {
          const botToken = channel.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
          if (botToken && channel.externalId) {
            await sendTelegramMessage(botToken, channel.externalId, `🔔 ${alertMsg}`);
          }
        }
      } catch (e: any) {
        console.error('[Easyorios] Telegram reminder error:', e.message);
      }

      console.log(`[Easyorios] Reminder fired: "${reminder.title}" for user ${reminder.userId}`);
    }
  } catch (e: any) {
    console.error('[Easyorios] checkDueReminders error:', e.message);
  }
}

let proactiveInterval: NodeJS.Timeout | null = null;
let reminderInterval: NodeJS.Timeout | null = null;
let schedulerInterval: NodeJS.Timeout | null = null;
let rulesInterval: NodeJS.Timeout | null = null;

export function startProactiveEngine(io?: any): void {
  console.log('[Easyorios] Proactive engine started (15min alerts + 1min reminders + 1min scheduler + 5min rules)');

  // Alerts: run once immediately, then every 15 minutes
  checkProactiveAlerts(io);
  proactiveInterval = setInterval(() => {
    checkProactiveAlerts(io);
  }, 15 * 60 * 1000);

  // Reminders: check every 1 minute
  checkDueReminders(io);
  reminderInterval = setInterval(() => {
    checkDueReminders(io);
  }, 60_000);

  // Scheduler: check every 60 seconds
  checkScheduledActions(io);
  schedulerInterval = setInterval(() => {
    checkScheduledActions(io);
  }, 60_000);

  // Rules engine: check every 5 minutes
  evaluateRules(io);
  rulesInterval = setInterval(() => {
    evaluateRules(io);
  }, 5 * 60 * 1000);

  // Evolution engine: continuous agency improvement (every 2h)
  startEvolutionMode();
}

export function stopProactiveEngine(): void {
  stopEvolutionMode();
  if (proactiveInterval) {
    clearInterval(proactiveInterval);
    proactiveInterval = null;
  }
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  if (rulesInterval) {
    clearInterval(rulesInterval);
    rulesInterval = null;
  }
  console.log('[Easyorios] Proactive engine stopped');
}
