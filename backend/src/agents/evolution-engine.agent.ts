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
}

export async function evolveSystem(): Promise<{ actions: EvolutionAction[]; governed: boolean }> {
  // Get latest strategic report
  const report = await prisma.strategicReport.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!report) {
    await agentLog('Evolution Engine', 'No strategic report found. Skipping evolution.', { type: 'info' });
    return { actions: [], governed: false };
  }

  const agentDetails = report.agentDetails as any[];
  const actions: EvolutionAction[] = [];

  // Governance limits
  const totalAgents = agentDetails.length || 1;
  let pausedCount = 0;
  let cronChanges = 0;
  const MAX_PAUSED_RATIO = 0.1;
  const MAX_CRON_CHANGES_RATIO = 0.2;

  const criticalAgents = agentDetails.filter((a: any) => a.classification === 'CRITICAL');

  for (const detail of agentDetails) {
    const agent = await prisma.agent.findFirst({ where: { function: detail.function } });
    if (!agent) continue;

    if (detail.classification === 'CRITICAL') {
      if (agent.autonomyLevel <= 1) {
        // Already at minimum — pause if governance allows
        const currentPaused = await prisma.agent.count({ where: { status: 'paused' } });
        if ((currentPaused + pausedCount) / totalAgents < MAX_PAUSED_RATIO) {
          await prisma.agent.update({ where: { id: agent.id }, data: { status: 'paused' } });
          pausedCount++;
          actions.push({ agentName: agent.name, action: 'PAUSED', from: 'active', to: 'paused', reason: 'CRITICAL with autonomy=1' });
        }
      } else {
        const newLevel = Math.max(1, agent.autonomyLevel - 1);
        await prisma.agent.update({ where: { id: agent.id }, data: { autonomyLevel: newLevel } });
        actions.push({ agentName: agent.name, action: 'REDUCE_AUTONOMY', from: agent.autonomyLevel, to: newLevel, reason: 'CRITICAL classification' });
      }
    } else if (detail.classification === 'HIGH_PERFORMER' && agent.autonomyLevel < 5) {
      const newLevel = Math.min(5, agent.autonomyLevel + 1);
      await prisma.agent.update({ where: { id: agent.id }, data: { autonomyLevel: newLevel } });
      actions.push({ agentName: agent.name, action: 'INCREASE_AUTONOMY', from: agent.autonomyLevel, to: newLevel, reason: 'HIGH_PERFORMER classification' });
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

  // Update the strategic report with evolution actions
  if (actions.length > 0) {
    await prisma.strategicReport.update({
      where: { id: report.id },
      data: { evolutionActions: actions as any },
    });
  }

  await agentLog('Evolution Engine', `Evolution complete: ${actions.length} actions taken. Governed=${governed}`, {
    type: 'result',
    payload: { actions, governed },
  });

  return { actions, governed };
}

export function startEvolutionEngine() {
  cron.schedule('0 */12 * * *', async () => {
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
