import prisma from '../../../config/database';
import { registry } from './module-registry';
import { CommandResult } from './module.interface';

interface TaskStep {
  step: number;
  prompt: string;
  moduleId: string;
  completed: boolean;
  result?: string;
}

interface TaskTemplate {
  type: string;
  patterns: RegExp[];
  description: string;
  steps: Omit<TaskStep, 'completed' | 'result'>[];
}

export { TaskTemplate };

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    type: 'plan_week',
    patterns: [
      /(?:planeja|planejar?|organiza|organizar?)\s+(?:minha|a)\s+semana/i,
      /(?:planejamento|plano)\s+(?:semanal|da\s+semana)/i,
    ],
    description: 'Planejamento semanal completo',
    steps: [
      { step: 1, prompt: 'briefing', moduleId: 'personal' },
      { step: 2, prompt: 'resumo financeiro', moduleId: 'finance' },
      { step: 3, prompt: 'listar lembretes', moduleId: 'personal' },
      { step: 4, prompt: 'meus to-dos', moduleId: 'personal' },
      { step: 5, prompt: 'status geral da agencia', moduleId: 'marketing' },
    ],
  },
  {
    type: 'morning_routine',
    patterns: [
      /(?:rotina\s+(?:da\s+)?manha|morning\s+routine|bom\s+dia\s+completo)/i,
    ],
    description: 'Rotina matinal completa',
    steps: [
      { step: 1, prompt: 'briefing', moduleId: 'personal' },
      { step: 2, prompt: 'listar lembretes', moduleId: 'personal' },
      { step: 3, prompt: 'status da casa', moduleId: 'smarthome' },
      { step: 4, prompt: 'noticias sobre tecnologia', moduleId: 'search' },
    ],
  },
  {
    type: 'budget_review',
    patterns: [
      /(?:revisao|revisão|review)\s+(?:financeira|do\s+orcamento|do\s+orçamento|budget)/i,
      /(?:analisar?|analise)\s+(?:meus?\s+)?(?:gastos?|financas|finanças)/i,
    ],
    description: 'Revisao financeira completa',
    steps: [
      { step: 1, prompt: 'resumo financeiro', moduleId: 'finance' },
      { step: 2, prompt: 'ultimas transacoes', moduleId: 'finance' },
      { step: 3, prompt: 'briefing', moduleId: 'personal' },
    ],
  },
  {
    type: 'night_routine',
    patterns: [
      /(?:rotina\s+(?:da\s+)?noite|boa\s+noite\s+completo|encerrar?\s+(?:o\s+)?dia)/i,
    ],
    description: 'Encerramento do dia',
    steps: [
      { step: 1, prompt: 'meus to-dos', moduleId: 'personal' },
      { step: 2, prompt: 'resumo financeiro', moduleId: 'finance' },
      { step: 3, prompt: 'listar posts pendentes', moduleId: 'marketing' },
    ],
  },
  {
    type: 'weekly_trend_analysis',
    patterns: [
      /(?:analise|análise)\s+(?:de\s+)?tendencias?\s+(?:semanal|da\s+semana)/i,
      /(?:trend|tendencia)\s+(?:analysis|semanal)/i,
    ],
    description: 'Analise de tendencias semanal',
    steps: [
      { step: 1, prompt: 'noticias sobre marketing digital', moduleId: 'search' },
      { step: 2, prompt: 'noticias sobre tecnologia', moduleId: 'search' },
      { step: 3, prompt: 'status geral da agencia', moduleId: 'marketing' },
      { step: 4, prompt: 'resumo financeiro', moduleId: 'finance' },
    ],
  },
  {
    type: 'daily_digest',
    patterns: [
      /(?:digest|resumo)\s+(?:diario|do\s+dia)/i,
      /(?:daily\s+digest)/i,
    ],
    description: 'Digest diario completo',
    steps: [
      { step: 1, prompt: 'briefing', moduleId: 'personal' },
      { step: 2, prompt: 'resumo financeiro', moduleId: 'finance' },
      { step: 3, prompt: 'status geral da agencia', moduleId: 'marketing' },
      { step: 4, prompt: 'noticias sobre tecnologia', moduleId: 'search' },
    ],
  },
];

export function findTemplateByType(type: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find(t => t.type === type);
}

export function matchTaskTemplate(message: string): TaskTemplate | null {
  for (const template of TASK_TEMPLATES) {
    for (const pattern of template.patterns) {
      if (pattern.test(message)) return template;
    }
  }
  return null;
}

export async function startMultiTurnTask(
  userId: string,
  template: TaskTemplate,
): Promise<{ taskId: string; description: string; totalSteps: number }> {
  const steps: TaskStep[] = template.steps.map(s => ({
    ...s,
    completed: false,
  }));

  const task = await prisma.conversationTask.create({
    data: {
      userId,
      type: template.type,
      steps: steps as any,
      currentStep: 0,
      context: {},
    },
  });

  return {
    taskId: task.id,
    description: template.description,
    totalSteps: steps.length,
  };
}

export async function executeNextStep(
  taskId: string,
  userId: string,
  userRole?: string,
): Promise<{ result: CommandResult; isComplete: boolean; stepNumber: number; totalSteps: number } | null> {
  const task = await prisma.conversationTask.findUnique({ where: { id: taskId } });
  if (!task || task.status !== 'active') return null;

  const steps = task.steps as unknown as TaskStep[];
  const currentIdx = task.currentStep;

  if (currentIdx >= steps.length) {
    await prisma.conversationTask.update({ where: { id: taskId }, data: { status: 'completed' } });
    return null;
  }

  const step = steps[currentIdx];

  // Route command through registry
  let result = await registry.routeCommand(step.prompt, userId, userRole);

  if (!result) {
    result = { command: step.prompt, success: true, message: `Step ${step.step}: sem resultado especifico.` };
  }

  // Update step as completed
  steps[currentIdx] = { ...step, completed: true, result: result.message };
  const nextStep = currentIdx + 1;
  const isComplete = nextStep >= steps.length;

  await prisma.conversationTask.update({
    where: { id: taskId },
    data: {
      steps: steps as any,
      currentStep: nextStep,
      status: isComplete ? 'completed' : 'active',
    },
  });

  return {
    result,
    isComplete,
    stepNumber: currentIdx + 1,
    totalSteps: steps.length,
  };
}

export async function executeFullTask(
  userId: string,
  template: TaskTemplate,
  userRole?: string,
): Promise<CommandResult> {
  const { taskId, description, totalSteps } = await startMultiTurnTask(userId, template);

  const results: string[] = [`**${description}** (${totalSteps} etapas)\n`];

  for (let i = 0; i < totalSteps; i++) {
    const stepResult = await executeNextStep(taskId, userId, userRole);
    if (stepResult) {
      results.push(`**Etapa ${stepResult.stepNumber}/${stepResult.totalSteps}:**\n${stepResult.result.message}\n`);
    }
  }

  return {
    command: `task_${template.type}`,
    success: true,
    message: results.join('\n'),
    data: { taskId, type: template.type, totalSteps },
  };
}
