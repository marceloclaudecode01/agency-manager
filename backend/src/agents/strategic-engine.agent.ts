import cron from 'node-cron';
import prisma from '../config/database';
import { agentLog } from './agent-logger';
import { isSafeModeActive, isAgentPaused } from './safe-mode';

interface AgentClassification {
  name: string;
  function: string;
  classification: string;
  successRate: number;
  autonomyLevel: number;
  impactScore: number;
  totalExecs: number;
}

function classify(successRate: number, impactScore: number): string {
  if (successRate < 60) return 'CRITICAL';
  if (successRate < 80) return 'LOW_PERFORMER';
  if (impactScore > 80 && successRate > 90) return 'HIGH_PERFORMER';
  return 'STABLE';
}

export async function evaluateSystem(): Promise<{
  healthScore: number;
  totalAgents: number;
  classifications: Record<string, number>;
  agentDetails: AgentClassification[];
}> {
  const agents = await prisma.agent.findMany({
    where: { status: { not: 'paused' } },
    include: { performances: true },
  });

  const agentDetails: AgentClassification[] = [];
  const classCount: Record<string, number> = {
    HIGH_PERFORMER: 0,
    STABLE: 0,
    LOW_PERFORMER: 0,
    CRITICAL: 0,
  };

  for (const agent of agents) {
    const perf = agent.performances[0];
    const successRate = perf?.successRate ?? 100;
    const impactScore = perf?.impactScore ?? 50;
    const classification = perf?.totalExecs ? classify(successRate, impactScore) : 'STABLE';

    classCount[classification]++;

    // Update classification in performance record
    if (perf) {
      await prisma.agentPerformance.update({
        where: { agentId: agent.id },
        data: { classification },
      });
    }

    agentDetails.push({
      name: agent.name,
      function: agent.function,
      classification,
      successRate,
      autonomyLevel: agent.autonomyLevel,
      impactScore,
      totalExecs: perf?.totalExecs ?? 0,
    });
  }

  // Health score: weighted by classification
  const total = agents.length || 1;
  const healthScore = Math.round(
    ((classCount.HIGH_PERFORMER * 100) +
     (classCount.STABLE * 75) +
     (classCount.LOW_PERFORMER * 40) +
     (classCount.CRITICAL * 10)) / total
  );

  // Save strategic report
  await prisma.strategicReport.create({
    data: {
      healthScore,
      totalAgents: agents.length,
      classifications: classCount,
      agentDetails: agentDetails as any,
    },
  });

  await agentLog('Strategic Engine', `System evaluation: health=${healthScore}%, ${agents.length} agents. CRITICAL=${classCount.CRITICAL}, HIGH=${classCount.HIGH_PERFORMER}`, {
    type: 'result',
    payload: { healthScore, classCount },
  });

  return { healthScore, totalAgents: agents.length, classifications: classCount, agentDetails };
}

export function startStrategicEngine() {
  cron.schedule('0 */6 * * *', async () => {
    try {
      if (await isSafeModeActive() || await isAgentPaused('Strategic Engine')) return;
      await evaluateSystem();
    } catch (err: any) {
      console.error('[StrategicEngine] Error:', err.message);
      await agentLog('Strategic Engine', `Error: ${err.message}`, { type: 'error' });
    }
  });

  console.log('[StrategicEngine] Strategic engine started (every 6h)');
}
