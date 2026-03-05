import cron from 'node-cron';
import prisma from '../config/database';
import { agentLog } from './agent-logger';
import { isSafeModeActive, isAgentPaused } from './safe-mode';
import { notificationsService } from '../modules/notifications/notifications.service';

interface EvolutionAction {
  agentName: string;
  action: string;
  from: any;
  to: any;
  reason: string;
  timestamp: string;
}

export async function evolveSystem(): Promise<{ actions: EvolutionAction[]; governed: boolean }> {
  // Patch: requireLatestStrategicReport + abortIfNoReport
  const report = await prisma.strategicReport.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!report) {
    await agentLog('Evolution Engine', 'ABORT: No strategic report found. Run evaluation first.', { type: 'error' });
    return { actions: [], governed: false };
  }

  const agentDetails = report.agentDetails as any[];
  const actions: EvolutionAction[] = [];

  // Governance limits from patch spec
  const totalAgents = agentDetails.length || 1;
  let pausedCount = 0;
  let autonomyChanges = 0;
  const MAX_PAUSED_RATIO = 0.1;
  const MAX_AUTONOMY_CHANGES_RATIO = 0.2;
  const maxAutonomyChanges = Math.max(1, Math.floor(totalAgents * MAX_AUTONOMY_CHANGES_RATIO));

  const criticalAgents = agentDetails.filter((a: any) => a.classification === 'CRITICAL');

  for (const detail of agentDetails) {
    const agent = await prisma.agent.findFirst({ where: { function: detail.function } });
    if (!agent) continue;

    if (detail.classification === 'CRITICAL') {
      if (autonomyChanges >= maxAutonomyChanges) continue;

      if (agent.autonomyLevel <= 1) {
        // Patch: pauseIfErrorRateHigh — pause if governance allows
        const currentPaused = await prisma.agent.count({ where: { status: 'paused' } });
        if ((currentPaused + pausedCount) / totalAgents < MAX_PAUSED_RATIO) {
          await prisma.agent.update({ where: { id: agent.id }, data: { status: 'paused' } });
          pausedCount++;
          autonomyChanges++;
          actions.push({ agentName: agent.name, action: 'PAUSED', from: 'active', to: 'paused', reason: 'CRITICAL with autonomy=1, error rate high', timestamp: new Date().toISOString() });
        }
      } else {
        const newLevel = Math.max(1, agent.autonomyLevel - 1);
        await prisma.agent.update({ where: { id: agent.id }, data: { autonomyLevel: newLevel } });
        autonomyChanges++;
        actions.push({ agentName: agent.name, action: 'REDUCE_AUTONOMY', from: agent.autonomyLevel, to: newLevel, reason: 'CRITICAL classification', timestamp: new Date().toISOString() });
      }
    } else if (detail.classification === 'HIGH_PERFORMER' && agent.autonomyLevel < 5) {
      if (autonomyChanges >= maxAutonomyChanges) continue;

      const newLevel = Math.min(5, agent.autonomyLevel + 1);
      await prisma.agent.update({ where: { id: agent.id }, data: { autonomyLevel: newLevel } });
      autonomyChanges++;
      actions.push({ agentName: agent.name, action: 'INCREASE_AUTONOMY', from: agent.autonomyLevel, to: newLevel, reason: 'HIGH_PERFORMER classification', timestamp: new Date().toISOString() });
    } else if (detail.classification === 'LOW_PERFORMER') {
      // Patch: monitorOnly — log but don't change anything
      actions.push({ agentName: agent.name, action: 'MONITOR', from: agent.autonomyLevel, to: agent.autonomyLevel, reason: 'LOW_PERFORMER — monitoring only', timestamp: new Date().toISOString() });
    }
  }

  // Governance: 3+ CRITICAL → notify admin
  let governed = false;
  if (criticalAgents.length >= 3) {
    governed = true;
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const admin of admins) {
      await notificationsService.createAndEmit(
        admin.id,
        'TASK_ASSIGNED',
        'ALERTA: Agentes em estado crítico',
        `${criticalAgents.length} agentes estão CRITICAL: ${criticalAgents.map((a: any) => a.name).join(', ')}. Intervenção manual recomendada.`
      );
    }
    await agentLog('Evolution Engine', `GOVERNANCE ALERT: ${criticalAgents.length} CRITICAL agents detected. Admin notified.`, { type: 'error' });
  }

  // Patch: mandatoryAuditLog — always persist evolution actions to report
  await prisma.strategicReport.update({
    where: { id: report.id },
    data: { evolutionActions: actions as any },
  });

  // Patch: audit log entry
  await agentLog('Evolution Engine', `Evolution complete: ${actions.length} actions (${autonomyChanges} autonomy changes). Governed=${governed}`, {
    type: 'result',
    payload: { actions, governed, autonomyChanges, totalAgents },
  });

  return { actions, governed };
}

export function startEvolutionEngine() {
  cron.schedule('0 3 * * 0', async () => { // Weekly on Sunday 03:00 (was every 12h)
    try {
      if (await isSafeModeActive() || await isAgentPaused('Evolution Engine')) return;
      await evolveSystem();
    } catch (err: any) {
      console.error('[EvolutionEngine] Error:', err.message);
      await agentLog('Evolution Engine', `Error: ${err.message}`, { type: 'error' });
    }
  });

  console.log('[EvolutionEngine] Evolution engine started (every 12h)');
}
