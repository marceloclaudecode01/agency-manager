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

// Patch v1.0.0: updated classification thresholds
function classify(successRate: number, impactScore: number): string {
  if (successRate < 60) return 'CRITICAL';
  if (successRate < 75) return 'LOW_PERFORMER';
  if (successRate >= 75 && impactScore > 80) return 'HIGH_PERFORMER';
  return 'STABLE';
}

function computeConfidence(totalExecutions: number): string {
  if (totalExecutions >= 500) return 'HIGH';
  if (totalExecutions >= 50) return 'MEDIUM';
  return 'LOW';
}

export async function evaluateSystem(): Promise<{
  healthScore: number;
  confidenceLevel: string;
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

  let totalExecutions = 0;

  for (const agent of agents) {
    const perf = agent.performances[0];

    // Patch: default to 0 if missing (never assume healthy without data)
    const successRate = perf?.successRate ?? 0;
    const impactScore = perf?.impactScore ?? 0;
    const totalExecs = perf?.totalExecs ?? 0;

    totalExecutions += totalExecs;

    // Patch: always classify — minimumExecutionsRequired=1, neverAbortOnLowData
    const classification = classify(successRate, impactScore);
    classCount[classification]++;

    // Upsert performance record with classification
    if (perf) {
      await prisma.agentPerformance.update({
        where: { agentId: agent.id },
        data: { classification },
      });
    } else {
      // Create performance record for agents that have never been tracked
      await prisma.agentPerformance.create({
        data: {
          agentId: agent.id,
          successRate: 0,
          errorCount: 0,
          totalExecs: 0,
          avgDurationMs: 0,
          impactScore: 0,
          classification,
        },
      });
    }

    agentDetails.push({
      name: agent.name,
      function: agent.function,
      classification,
      successRate,
      autonomyLevel: agent.autonomyLevel,
      impactScore,
      totalExecs,
    });
  }

  // Patch: health score formula from spec
  const total = agents.length || 1;
  const healthScore = Math.round(
    ((classCount.HIGH_PERFORMER * 1.0) +
     (classCount.STABLE * 0.7) +
     (classCount.LOW_PERFORMER * 0.4) +
     (classCount.CRITICAL * 0.1)) / total * 100
  );

  const confidenceLevel = computeConfidence(totalExecutions);

  // Patch: always persist strategic report (alwaysPersistStrategicReport=true)
  await prisma.strategicReport.create({
    data: {
      healthScore,
      confidenceLevel,
      totalAgents: agents.length,
      classifications: classCount,
      agentDetails: agentDetails as any,
    },
  });

  await agentLog('Strategic Engine', `Evaluation: health=${healthScore}%, confidence=${confidenceLevel}, agents=${agents.length}. CRITICAL=${classCount.CRITICAL}, LOW=${classCount.LOW_PERFORMER}, STABLE=${classCount.STABLE}, HIGH=${classCount.HIGH_PERFORMER}`, {
    type: 'result',
    payload: { healthScore, confidenceLevel, classCount },
  });

  return { healthScore, confidenceLevel, totalAgents: agents.length, classifications: classCount, agentDetails };
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
