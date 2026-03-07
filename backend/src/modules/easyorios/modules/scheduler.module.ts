import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction, CommandResult } from '../core/module.interface';
import { calculateNextRun, seedDefaultSchedules } from '../core/scheduler-engine';
import { TASK_TEMPLATES } from '../core/task-engine';
import prisma from '../../../config/database';

const DAY_NAMES: Record<string, string> = {
  mon: 'Segunda', tue: 'Terca', wed: 'Quarta', thu: 'Quinta',
  fri: 'Sexta', sat: 'Sabado', sun: 'Domingo',
};

function formatScheduleDays(days: string | null): string {
  if (!days) return 'Todo dia';
  return days.split(',').map(d => DAY_NAMES[d.trim().toLowerCase()] || d).join(', ');
}

function parseTimeFromText(text: string): { hour: number; minute: number } | null {
  // "as 7h" / "as 7:30" / "7h30" / "22h" / "8:00"
  const match = text.match(/(\d{1,2})\s*(?::|h)\s*(\d{0,2})/i);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function parseDaysFromText(text: string): string | null {
  const dayMap: Record<string, string> = {
    'segunda': 'mon', 'seg': 'mon', 'terca': 'tue', 'ter': 'tue',
    'quarta': 'wed', 'qua': 'wed', 'quinta': 'thu', 'qui': 'thu',
    'sexta': 'fri', 'sex': 'fri', 'sabado': 'sat', 'sab': 'sat',
    'domingo': 'sun', 'dom': 'sun',
    'dias uteis': 'mon,tue,wed,thu,fri', 'dias de semana': 'mon,tue,wed,thu,fri',
    'fim de semana': 'sat,sun', 'weekend': 'sat,sun',
  };

  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const [key, val] of Object.entries(dayMap)) {
    if (lower.includes(key)) {
      if (val.includes(',')) return val; // compound like "dias uteis"
      found.push(val);
    }
  }

  return found.length > 0 ? [...new Set(found)].join(',') : null;
}

export class SchedulerModule implements EasyoriosModule {
  id = 'scheduler';
  name = 'Agendamentos';
  icon = 'Calendar';
  contextPriority = 11;

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'list_schedules',
        description: 'Listar agendamentos ativos',
        patterns: [
          /(?:meus?\s+)?(?:agendamentos?|rotinas?|schedules?)/i,
          /(?:listar?|ver|mostrar?)\s+(?:agendamentos?|rotinas?)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const schedules = await prisma.scheduledAction.findMany({
            where: { userId },
            orderBy: { scheduleHour: 'asc' },
          });

          if (schedules.length === 0) {
            return {
              command: 'list_schedules',
              success: true,
              message: 'Nenhum agendamento encontrado. Use "agenda briefing as 7h" para criar.',
            };
          }

          const lines = schedules.map(s => {
            const status = s.enabled ? 'ativo' : 'desativado';
            const time = `${String(s.scheduleHour).padStart(2, '0')}:${String(s.scheduleMinute).padStart(2, '0')}`;
            const days = formatScheduleDays(s.scheduleDays);
            const next = s.nextRunAt ? new Date(s.nextRunAt).toLocaleString('pt-BR') : 'N/A';
            return `- **${s.name}** (${status}) — ${time} | ${days} | Proximo: ${next}`;
          });

          return {
            command: 'list_schedules',
            success: true,
            message: `**Agendamentos (${schedules.length}):**\n${lines.join('\n')}`,
            data: { count: schedules.length },
          };
        },
      },
      {
        name: 'add_schedule',
        description: 'Criar novo agendamento',
        patterns: [
          /(?:agenda[r]?|agendar?|cria[r]?\s+(?:agendamento|rotina)|nova?\s+rotina)\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const text = (match[1] || '').trim();
          if (!text) {
            return { command: 'add_schedule', success: false, message: 'Informe o que deseja agendar. Ex: "agenda briefing as 7h"' };
          }

          const time = parseTimeFromText(text);
          if (!time) {
            return { command: 'add_schedule', success: false, message: 'Nao encontrei um horario. Use formato "as 7h" ou "7:30".' };
          }

          const days = parseDaysFromText(text);

          // Try to identify task template
          let taskTemplate: string | null = null;
          let name = text.replace(/\b(?:as|às)\s+\d{1,2}\s*(?::|h)\s*\d{0,2}/i, '').trim();

          for (const t of TASK_TEMPLATES) {
            if (text.toLowerCase().includes(t.type.replace(/_/g, ' '))) {
              taskTemplate = t.type;
              name = t.description;
              break;
            }
            // Match description keywords
            const descWords = t.description.toLowerCase().split(' ');
            if (descWords.some(w => w.length > 3 && text.toLowerCase().includes(w))) {
              taskTemplate = t.type;
              name = t.description;
              break;
            }
          }

          // Common keyword mapping
          const keywordMap: Record<string, string> = {
            'briefing': 'morning_routine',
            'matinal': 'morning_routine',
            'manha': 'morning_routine',
            'noturna': 'night_routine',
            'noite': 'night_routine',
            'semanal': 'plan_week',
            'semana': 'plan_week',
            'financeiro': 'budget_review',
            'financeira': 'budget_review',
            'digest': 'daily_digest',
          };

          if (!taskTemplate) {
            const lower = text.toLowerCase();
            for (const [kw, tmpl] of Object.entries(keywordMap)) {
              if (lower.includes(kw)) {
                taskTemplate = tmpl;
                name = name || kw;
                break;
              }
            }
          }

          const type = taskTemplate ? 'task_template' : 'command';
          const command = taskTemplate ? null : name;
          if (!name) name = taskTemplate || 'Agendamento personalizado';

          const nextRun = calculateNextRun(time.hour, time.minute, days);

          await prisma.scheduledAction.create({
            data: {
              userId,
              name,
              type,
              taskTemplate,
              command,
              scheduleHour: time.hour,
              scheduleMinute: time.minute,
              scheduleDays: days,
              nextRunAt: nextRun,
            },
          });

          const timeStr = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
          const daysStr = formatScheduleDays(days);

          return {
            command: 'add_schedule',
            success: true,
            message: `Agendamento criado: **${name}** as ${timeStr} (${daysStr}). Proximo: ${nextRun.toLocaleString('pt-BR')}.`,
          };
        },
      },
      {
        name: 'cancel_schedule',
        description: 'Cancelar/remover agendamento',
        patterns: [
          /(?:cancela[r]?|remove[r]?|deleta[r]?|excluir?)\s+(?:agendamento|rotina)\s+(?:d[aoe]\s+)?(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const search = (match[1] || '').trim().toLowerCase();
          if (!search) return { command: 'cancel_schedule', success: false, message: 'Informe o nome do agendamento a cancelar.' };

          const schedule = await prisma.scheduledAction.findFirst({
            where: {
              userId,
              name: { contains: search, mode: 'insensitive' },
            },
          });

          if (!schedule) {
            return { command: 'cancel_schedule', success: false, message: `Agendamento "${search}" nao encontrado.` };
          }

          await prisma.scheduledAction.delete({ where: { id: schedule.id } });

          return {
            command: 'cancel_schedule',
            success: true,
            message: `Agendamento "${schedule.name}" removido.`,
          };
        },
      },
      {
        name: 'enable_schedule',
        description: 'Ativar/desativar agendamento',
        patterns: [
          /(?:ativa[r]?|enable)\s+(?:agendamento|rotina)\s+(?:d[aoe]\s+)?(.+)/i,
          /(?:desativa[r]?|disable|pausa[r]?)\s+(?:agendamento|rotina)\s+(?:d[aoe]\s+)?(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const search = (match[1] || match[2] || '').trim().toLowerCase();
          const enable = /^(?:ativa|enable)/i.test(match[0]);

          const schedule = await prisma.scheduledAction.findFirst({
            where: {
              userId,
              name: { contains: search, mode: 'insensitive' },
            },
          });

          if (!schedule) {
            return { command: 'enable_schedule', success: false, message: `Agendamento "${search}" nao encontrado.` };
          }

          const nextRun = enable ? calculateNextRun(schedule.scheduleHour, schedule.scheduleMinute, schedule.scheduleDays) : null;

          await prisma.scheduledAction.update({
            where: { id: schedule.id },
            data: { enabled: enable, nextRunAt: nextRun },
          });

          return {
            command: 'enable_schedule',
            success: true,
            message: `Agendamento "${schedule.name}" ${enable ? 'ativado' : 'desativado'}.`,
          };
        },
      },
      {
        name: 'set_preference',
        description: 'Configurar preferencia do usuario',
        patterns: [
          /(?:configura[r]?|define|setar?|set)\s+(?:minha?\s+)?cidade\s+(?:para\s+)?(.+)/i,
          /(?:minha?\s+)?cidade\s+[eé]\s+(.+)/i,
          /(?:configura[r]?|define|setar?|set)\s+(?:meu?\s+)?(?:timezone|fuso)\s+(?:para\s+)?(.+)/i,
          /(?:configura[r]?|define|setar?|set)\s+(?:canal\s+preferido|preferred\s+channel)\s+(?:para\s+)?(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const value = (match[1] || '').trim();
          if (!value) return { command: 'set_preference', success: false, message: 'Informe o valor.' };

          let key = 'city';
          const input = match[0].toLowerCase();
          if (input.includes('timezone') || input.includes('fuso')) key = 'timezone';
          else if (input.includes('canal') || input.includes('channel')) key = 'preferred_channel';

          await prisma.userPreference.upsert({
            where: { userId_key: { userId, key } },
            update: { value },
            create: { userId, key, value },
          });

          return {
            command: 'set_preference',
            success: true,
            message: `Preferencia "${key}" configurada para: ${value}.`,
          };
        },
      },
    ];
  }

  async gatherContext(userId: string): Promise<ModuleContext> {
    let activeCount = 0;
    let nextAction: string | null = null;

    try {
      activeCount = await prisma.scheduledAction.count({
        where: { userId, enabled: true },
      });

      const next = await prisma.scheduledAction.findFirst({
        where: { userId, enabled: true, nextRunAt: { not: null } },
        orderBy: { nextRunAt: 'asc' },
      });

      if (next?.nextRunAt) {
        nextAction = `${next.name} as ${new Date(next.nextRunAt).toLocaleString('pt-BR')}`;
      }
    } catch {}

    return {
      moduleId: 'scheduler',
      summary: `${activeCount} agendamentos ativos${nextAction ? ` | Proximo: ${nextAction}` : ''}`,
      metrics: { activeSchedules: activeCount },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Meus Agendamentos', prompt: 'meus agendamentos', icon: 'Calendar', moduleId: 'scheduler' },
    ];
  }

  async getProactiveAlerts(_userId: string): Promise<ModuleAlert[]> {
    return [];
  }
}
