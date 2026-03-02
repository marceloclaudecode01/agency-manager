import prisma from '../config/database';
import { agentLog } from './agent-logger';

export async function trackAgentExecution(agentFunction: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  let success = true;

  try {
    await fn();
  } catch (err: any) {
    success = false;
    throw err;
  } finally {
    const durationMs = Date.now() - start;

    try {
      // Find the agent by function key
      const agent = await prisma.agent.findFirst({ where: { function: agentFunction } });
      if (!agent) return;

      // Upsert performance record
      const existing = await prisma.agentPerformance.findUnique({ where: { agentId: agent.id } });

      if (existing) {
        const newTotal = existing.totalExecs + 1;
        const newErrors = existing.errorCount + (success ? 0 : 1);
        // Rolling average for successRate and duration
        const newSuccessRate = ((existing.successRate * existing.totalExecs) + (success ? 100 : 0)) / newTotal;
        const newAvgDuration = ((existing.avgDurationMs * existing.totalExecs) + durationMs) / newTotal;

        await prisma.agentPerformance.update({
          where: { agentId: agent.id },
          data: {
            totalExecs: newTotal,
            errorCount: newErrors,
            successRate: Math.round(newSuccessRate * 100) / 100,
            avgDurationMs: Math.round(newAvgDuration),
            lastExecAt: new Date(),
          },
        });
      } else {
        await prisma.agentPerformance.create({
          data: {
            agentId: agent.id,
            totalExecs: 1,
            errorCount: success ? 0 : 1,
            successRate: success ? 100 : 0,
            avgDurationMs: durationMs,
            lastExecAt: new Date(),
          },
        });
      }

      // Update agent lastRunAt
      await prisma.agent.update({ where: { id: agent.id }, data: { lastRunAt: new Date() } });
    } catch (trackErr: any) {
      // Never break agent execution due to tracking failure
      console.error('[PerformanceTracker] Error:', trackErr.message);
    }
  }
}
