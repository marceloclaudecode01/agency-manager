import prisma from '../../../config/database';
import { sendTelegramMessage } from '../services/telegram.service';
import { findTemplateByType } from './task-engine';
import { executeFullTask } from './task-engine';
import { registry } from './module-registry';

const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export function calculateNextRun(hour: number, minute: number, days: string | null): Date {
  const now = new Date();
  const target = new Date(now);
  target.setSeconds(0, 0);
  target.setHours(hour, minute);

  // If target is in the past today, start from tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  if (!days) return target; // every day

  const allowedDays = days.split(',').map(d => DAY_MAP[d.trim().toLowerCase()]).filter(d => d !== undefined);
  if (allowedDays.length === 0) return target;

  // Find next allowed day
  for (let i = 0; i < 7; i++) {
    const dayOfWeek = target.getDay();
    if (allowedDays.includes(dayOfWeek)) return target;
    target.setDate(target.getDate() + 1);
  }

  return target;
}

export async function deliverViaTelegram(userId: string, text: string): Promise<boolean> {
  try {
    const channel = await prisma.communicationChannel.findFirst({
      where: { userId, platform: 'telegram', isActive: true },
    });
    if (!channel) return false;

    const botToken = channel.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    if (!botToken || !channel.externalId) return false;

    await sendTelegramMessage(botToken, channel.externalId, text);
    return true;
  } catch (e: any) {
    console.error('[Scheduler] Telegram delivery error:', e.message);
    return false;
  }
}

async function executeScheduledAction(action: any, io?: any): Promise<string> {
  const userId = action.userId;

  if (action.type === 'task_template' && action.taskTemplate) {
    const template = findTemplateByType(action.taskTemplate);
    if (!template) return `Template "${action.taskTemplate}" nao encontrado.`;

    const result = await executeFullTask(userId, template);
    return result.message;
  }

  if (action.type === 'command' && action.command) {
    const result = await registry.routeCommand(action.command, userId);
    if (result) return result.message;
    return `Comando executado: ${action.command}`;
  }

  return 'Acao sem tipo definido.';
}

export async function checkScheduledActions(io?: any): Promise<void> {
  try {
    const now = new Date();
    const dueActions = await prisma.scheduledAction.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      take: 20,
    });

    for (const action of dueActions) {
      try {
        console.log(`[Scheduler] Executing: "${action.name}" for user ${action.userId}`);

        const resultText = await executeScheduledAction(action, io);
        const formattedResult = `**${action.name}**\n\n${resultText}`;

        // Deliver result based on channel preference
        const channel = action.channel || 'both';

        if (channel === 'telegram' || channel === 'both') {
          await deliverViaTelegram(action.userId, formattedResult);
        }

        if (channel === 'web' || channel === 'both') {
          if (io) {
            io.to(`user:${action.userId}`).emit('easyorios:scheduled-result', {
              actionName: action.name,
              result: formattedResult,
              executedAt: now.toISOString(),
            });
          }
        }

        // Update lastRunAt + calculate nextRunAt
        const nextRun = calculateNextRun(action.scheduleHour, action.scheduleMinute, action.scheduleDays);
        await prisma.scheduledAction.update({
          where: { id: action.id },
          data: { lastRunAt: now, nextRunAt: nextRun },
        });

        console.log(`[Scheduler] Done: "${action.name}" — next run: ${nextRun.toISOString()}`);
      } catch (e: any) {
        console.error(`[Scheduler] Error executing "${action.name}":`, e.message);
      }
    }
  } catch (e: any) {
    console.error('[Scheduler] checkScheduledActions error:', e.message);
  }
}

export async function seedDefaultSchedules(userId: string): Promise<void> {
  try {
    const existing = await prisma.scheduledAction.count({ where: { userId } });
    if (existing > 0) return; // already seeded

    const defaults = [
      {
        name: 'Briefing Matinal',
        type: 'task_template',
        taskTemplate: 'morning_routine',
        scheduleHour: 7,
        scheduleMinute: 0,
        scheduleDays: null,
        channel: 'both',
      },
      {
        name: 'Rotina Noturna',
        type: 'task_template',
        taskTemplate: 'night_routine',
        scheduleHour: 22,
        scheduleMinute: 0,
        scheduleDays: null,
        channel: 'both',
      },
      {
        name: 'Planejamento Semanal',
        type: 'task_template',
        taskTemplate: 'plan_week',
        scheduleHour: 8,
        scheduleMinute: 0,
        scheduleDays: 'mon',
        channel: 'both',
      },
      {
        name: 'Pesquisa Semanal',
        type: 'task_template',
        taskTemplate: 'content_research',
        scheduleHour: 6,
        scheduleMinute: 0,
        scheduleDays: 'mon',
        channel: 'both',
      },
      {
        name: 'Relatório Semanal NLM',
        type: 'task_template',
        taskTemplate: 'weekly_nlm_report',
        scheduleHour: 18,
        scheduleMinute: 0,
        scheduleDays: 'fri',
        channel: 'both',
      },
    ];

    for (const d of defaults) {
      const nextRun = calculateNextRun(d.scheduleHour, d.scheduleMinute, d.scheduleDays);
      await prisma.scheduledAction.create({
        data: {
          userId,
          name: d.name,
          type: d.type,
          taskTemplate: d.taskTemplate,
          scheduleHour: d.scheduleHour,
          scheduleMinute: d.scheduleMinute,
          scheduleDays: d.scheduleDays,
          channel: d.channel,
          nextRunAt: nextRun,
        },
      });
    }

    console.log(`[Scheduler] Seeded ${defaults.length} default schedules for user ${userId}`);
  } catch (e: any) {
    console.error('[Scheduler] Seed error:', e.message);
  }
}
