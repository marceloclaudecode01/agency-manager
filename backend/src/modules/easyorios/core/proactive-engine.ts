import prisma from '../../../config/database';
import { registry } from './module-registry';

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

let proactiveInterval: NodeJS.Timeout | null = null;

export function startProactiveEngine(io?: any): void {
  console.log('[Easyorios] Proactive engine started (15min interval)');

  // Run once immediately
  checkProactiveAlerts(io);

  // Then every 15 minutes
  proactiveInterval = setInterval(() => {
    checkProactiveAlerts(io);
  }, 15 * 60 * 1000);
}

export function stopProactiveEngine(): void {
  if (proactiveInterval) {
    clearInterval(proactiveInterval);
    proactiveInterval = null;
    console.log('[Easyorios] Proactive engine stopped');
  }
}
