import prisma from '../../../config/database';
import { registry } from './module-registry';
import { deliverViaTelegram } from './scheduler-engine';
import { findTemplateByType, executeFullTask } from './task-engine';

interface TriggerConfig {
  moduleId: string;
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
}

interface ActionConfig {
  message?: string;
  command?: string;
  template?: string;
}

const OPERATORS: Record<string, (a: number, b: number) => boolean> = {
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
  eq: (a, b) => a === b,
};

async function evaluateTrigger(triggerConfig: TriggerConfig, userId: string): Promise<boolean> {
  try {
    const mod = registry.getModule(triggerConfig.moduleId);
    if (!mod) return false;

    const context = await mod.gatherContext(userId);
    const value = context.metrics[triggerConfig.metric];
    if (value === undefined || value === null) return false;

    const op = OPERATORS[triggerConfig.operator];
    if (!op) return false;

    return op(Number(value), triggerConfig.threshold);
  } catch (e: any) {
    console.error(`[RulesEngine] Trigger eval error:`, e.message);
    return false;
  }
}

async function executeAction(rule: any, userId: string, io?: any): Promise<void> {
  const config = rule.actionConfig as ActionConfig;

  switch (rule.actionType) {
    case 'alert': {
      const msg = config.message || `Regra "${rule.name}" disparou!`;
      await prisma.easyoriosAlert.create({
        data: {
          userId,
          moduleId: 'automation',
          title: rule.name,
          message: msg,
          severity: 'warning',
        },
      });
      if (io) {
        io.to(`user:${userId}`).emit('easyorios:alert', {
          moduleId: 'automation',
          title: rule.name,
          message: msg,
          severity: 'warning',
          createdAt: new Date().toISOString(),
        });
      }
      break;
    }

    case 'telegram_message': {
      const msg = config.message || `Regra "${rule.name}" disparou!`;
      await deliverViaTelegram(userId, `**Automacao:** ${msg}`);
      break;
    }

    case 'command': {
      if (config.command) {
        await registry.routeCommand(config.command, userId);
      }
      break;
    }

    case 'task_template': {
      if (config.template) {
        const template = findTemplateByType(config.template);
        if (template) {
          const result = await executeFullTask(userId, template);
          await deliverViaTelegram(userId, `**Automacao (${rule.name}):**\n${result.message}`);
        }
      }
      break;
    }
  }
}

export async function evaluateRules(io?: any): Promise<void> {
  try {
    const now = new Date();
    const rules = await prisma.automationRule.findMany({
      where: { enabled: true },
    });

    for (const rule of rules) {
      try {
        // Check cooldown
        if (rule.lastTriggeredAt) {
          const cooldownMs = (rule.cooldownMinutes || 60) * 60 * 1000;
          if (now.getTime() - new Date(rule.lastTriggeredAt).getTime() < cooldownMs) {
            continue;
          }
        }

        const triggerConfig = rule.triggerConfig as unknown as TriggerConfig;
        if (!triggerConfig?.moduleId || !triggerConfig?.metric) continue;

        const triggered = await evaluateTrigger(triggerConfig, rule.userId);
        if (!triggered) continue;

        console.log(`[RulesEngine] Rule triggered: "${rule.name}" for user ${rule.userId}`);

        await executeAction(rule, rule.userId, io);

        await prisma.automationRule.update({
          where: { id: rule.id },
          data: {
            lastTriggeredAt: now,
            triggerCount: { increment: 1 },
          },
        });
      } catch (e: any) {
        console.error(`[RulesEngine] Error evaluating rule "${rule.name}":`, e.message);
      }
    }
  } catch (e: any) {
    console.error('[RulesEngine] evaluateRules error:', e.message);
  }
}

export async function seedDefaultRules(userId: string): Promise<void> {
  try {
    const existing = await prisma.automationRule.count({ where: { userId } });
    if (existing > 0) return;

    const defaults = [
      {
        name: 'Engajamento Baixo',
        description: 'Alerta quando engajamento medio cai abaixo de 50',
        triggerType: 'metric_threshold',
        triggerConfig: { moduleId: 'marketing', metric: 'avgEngagement', operator: 'lt', threshold: 50 },
        actionType: 'alert',
        actionConfig: { message: 'O engajamento medio esta baixo. Considere ajustar a estrategia de conteudo.' },
        cooldownMinutes: 240,
      },
      {
        name: 'Gastos Altos',
        description: 'Avisa no Telegram quando gastos mensais ultrapassam R$3000',
        triggerType: 'metric_threshold',
        triggerConfig: { moduleId: 'finance', metric: 'monthlyExpenses', operator: 'gt', threshold: 3000 },
        actionType: 'telegram_message',
        actionConfig: { message: 'Seus gastos mensais ultrapassaram R$3.000. Hora de revisar o orcamento!' },
        cooldownMinutes: 1440,
      },
      {
        name: 'Muitos Dispositivos Ligados',
        description: 'Alerta quando ha mais de 5 dispositivos ativos',
        triggerType: 'metric_threshold',
        triggerConfig: { moduleId: 'smarthome', metric: 'activeDevices', operator: 'gt', threshold: 5 },
        actionType: 'alert',
        actionConfig: { message: 'Muitos dispositivos ligados. Considere desligar os que nao estao em uso.' },
        cooldownMinutes: 120,
      },
    ];

    for (const d of defaults) {
      await prisma.automationRule.create({
        data: {
          userId,
          name: d.name,
          description: d.description,
          triggerType: d.triggerType,
          triggerConfig: d.triggerConfig,
          actionType: d.actionType,
          actionConfig: d.actionConfig,
          cooldownMinutes: d.cooldownMinutes,
        },
      });
    }

    console.log(`[RulesEngine] Seeded ${defaults.length} default rules for user ${userId}`);
  } catch (e: any) {
    console.error('[RulesEngine] Seed error:', e.message);
  }
}
