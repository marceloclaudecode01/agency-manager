import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import prisma from '../../../config/database';

export class PersonalModule implements EasyoriosModule {
  id = 'personal';
  name = 'Assistente Pessoal';
  icon = 'User';
  contextPriority = 9;

  getCommands(): CommandDefinition[] {
    return [
      // ─── Reminders ───
      {
        name: 'add_reminder',
        description: 'Criar lembrete',
        patterns: [
          /(?:lembrar?|remind)\s+(?:de\s+|me\s+(?:de\s+)?)?(.+?)\s+(?:as|às|at)\s+(\d{1,2})[h:]?(\d{2})?\b/i,
          /(?:me\s+)?(?:lembre|lembrar?|remind)\s+(?:de\s+)?(.+?)\s+(?:amanha|amanhã|tomorrow)/i,
          /(?:lembrete|reminder):\s*(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const title = match[1]?.trim();
          if (!title) return { command: 'add_reminder', success: false, message: 'Titulo do lembrete nao informado.' };

          let dueAt = new Date();
          if (match[2]) {
            const hours = parseInt(match[2]);
            const minutes = parseInt(match[3] || '0');
            dueAt.setHours(hours, minutes, 0, 0);
            if (dueAt.getTime() < Date.now()) dueAt.setDate(dueAt.getDate() + 1);
          } else if (/amanha|amanhã|tomorrow/i.test(match[0])) {
            dueAt.setDate(dueAt.getDate() + 1);
            dueAt.setHours(9, 0, 0, 0);
          }

          const reminder = await prisma.reminder.create({
            data: { userId, title, dueAt },
          });

          const timeStr = dueAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          return {
            command: 'add_reminder',
            success: true,
            message: `Lembrete criado: "${title}" para ${timeStr}`,
            data: { id: reminder.id, title, dueAt: dueAt.toISOString() },
          };
        },
      },
      {
        name: 'list_reminders',
        description: 'Listar lembretes',
        patterns: [
          /(?:listar?|list|mostrar?|show|ver|meus?)\s+(?:os?\s+)?(?:lembretes?|reminders?)/i,
          /(?:que|quais)\s+lembretes?\s+(?:tenho|eu\s+tenho)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const reminders = await prisma.reminder.findMany({
            where: { userId, completed: false },
            orderBy: { dueAt: 'asc' },
            take: 10,
          });

          if (reminders.length === 0) {
            return { command: 'list_reminders', success: true, message: 'Nenhum lembrete pendente.' };
          }

          const lines = reminders.map((r, i) => {
            const time = r.dueAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            return `${i + 1}. "${r.title}" — ${time}`;
          });

          return {
            command: 'list_reminders',
            success: true,
            message: `${reminders.length} lembrete(s) pendentes:\n${lines.join('\n')}`,
            data: { reminders },
          };
        },
      },
      // ─── Notes ───
      {
        name: 'add_note',
        description: 'Criar nota rapida',
        patterns: [
          /(?:anotar?|note|nota):\s*(.+)/i,
          /(?:anotar?|salvar?\s+nota)\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const content = match[1]?.trim();
          if (!content) return { command: 'add_note', success: false, message: 'Conteudo da nota nao informado.' };

          const note = await prisma.personalNote.create({
            data: { userId, content },
          });

          return {
            command: 'add_note',
            success: true,
            message: `Nota salva: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            data: { id: note.id },
          };
        },
      },
      {
        name: 'list_notes',
        description: 'Listar notas',
        patterns: [
          /(?:listar?|list|mostrar?|show|ver|minhas?)\s+(?:as?\s+)?notas?/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const notes = await prisma.personalNote.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });

          if (notes.length === 0) {
            return { command: 'list_notes', success: true, message: 'Nenhuma nota salva.' };
          }

          const lines = notes.map((n, i) => {
            const date = n.createdAt.toLocaleDateString('pt-BR');
            return `${i + 1}. "${n.content.substring(0, 60)}${n.content.length > 60 ? '...' : ''}" (${date})`;
          });

          return {
            command: 'list_notes',
            success: true,
            message: `${notes.length} nota(s):\n${lines.join('\n')}`,
            data: { notes },
          };
        },
      },
      // ─── To-dos ───
      {
        name: 'add_todo',
        description: 'Criar to-do pessoal',
        patterns: [
          /(?:to-?do|tarefa\s+pessoal):\s*(.+)/i,
          /(?:adicionar?|add)\s+(?:to-?do|tarefa)\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const title = match[1]?.trim();
          if (!title) return { command: 'add_todo', success: false, message: 'Titulo do to-do nao informado.' };

          const todo = await prisma.personalTodo.create({
            data: { userId, title },
          });

          return {
            command: 'add_todo',
            success: true,
            message: `To-do criado: "${title}"`,
            data: { id: todo.id },
          };
        },
      },
      {
        name: 'list_todos',
        description: 'Listar to-dos',
        patterns: [
          /(?:listar?|list|mostrar?|show|ver|meus?)\s+(?:os?\s+)?to-?dos?/i,
          /(?:minhas?\s+)?(?:tarefas?\s+pessoais?|to-?dos?)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const todos = await prisma.personalTodo.findMany({
            where: { userId, completed: false },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });

          if (todos.length === 0) {
            return { command: 'list_todos', success: true, message: 'Nenhum to-do pendente.' };
          }

          const lines = todos.map((t, i) => `${i + 1}. "${t.title}" [${t.priority || 'MEDIUM'}]`);

          return {
            command: 'list_todos',
            success: true,
            message: `${todos.length} to-do(s) pendentes:\n${lines.join('\n')}`,
            data: { todos },
          };
        },
      },
      // ─── Briefing ───
      {
        name: 'daily_briefing',
        description: 'Resumo do dia',
        patterns: [
          /(?:briefing|resumo\s+(?:do\s+)?dia|daily\s+summary|bom\s+dia)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const [reminders, todos, notes] = await Promise.all([
            prisma.reminder.count({ where: { userId, completed: false, dueAt: { lte: new Date(Date.now() + 86400000) } } }),
            prisma.personalTodo.count({ where: { userId, completed: false } }),
            prisma.personalNote.count({ where: { userId } }),
          ]);

          return {
            command: 'daily_briefing',
            success: true,
            message: `Briefing pessoal:\n- ${reminders} lembrete(s) para hoje\n- ${todos} to-do(s) pendentes\n- ${notes} nota(s) salvas`,
            data: { reminders, todos, notes },
          };
        },
      },
    ];
  }

  async gatherContext(userId: string): Promise<ModuleContext> {
    const results = await Promise.allSettled([
      prisma.reminder.count({ where: { userId, completed: false } }),
      prisma.personalTodo.count({ where: { userId, completed: false } }),
      prisma.personalNote.count({ where: { userId } }),
      prisma.reminder.count({
        where: { userId, completed: false, dueAt: { lte: new Date(Date.now() + 86400000) } },
      }),
    ]);

    const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value : 0;

    return {
      moduleId: 'personal',
      summary: `${val(3)} lembretes hoje | ${val(1)} to-dos pendentes | ${val(2)} notas`,
      metrics: {
        pendingReminders: val(0),
        remindersToday: val(3),
        pendingTodos: val(1),
        totalNotes: val(2),
      },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Briefing', prompt: 'briefing', icon: 'Sun', moduleId: 'personal' },
      { label: 'Meus Lembretes', prompt: 'listar lembretes', icon: 'Bell', moduleId: 'personal' },
      { label: 'Meus To-dos', prompt: 'meus to-dos', icon: 'CheckSquare', moduleId: 'personal' },
      { label: 'Minhas Notas', prompt: 'minhas notas', icon: 'FileText', moduleId: 'personal' },
    ];
  }

  async getProactiveAlerts(userId: string): Promise<ModuleAlert[]> {
    const alerts: ModuleAlert[] = [];

    try {
      const overdueReminders = await prisma.reminder.count({
        where: { userId, completed: false, dueAt: { lt: new Date() } },
      });

      if (overdueReminders > 0) {
        alerts.push({
          id: 'personal-overdue-reminders',
          moduleId: 'personal',
          title: 'Lembretes atrasados',
          message: `Voce tem ${overdueReminders} lembrete(s) atrasado(s).`,
          severity: 'warning',
          createdAt: new Date(),
        });
      }

      const pendingTodos = await prisma.personalTodo.count({
        where: { userId, completed: false },
      });

      if (pendingTodos >= 5) {
        alerts.push({
          id: 'personal-many-todos',
          moduleId: 'personal',
          title: 'Muitos to-dos pendentes',
          message: `${pendingTodos} to-dos pendentes. Considere priorizar.`,
          severity: 'info',
          createdAt: new Date(),
        });
      }
    } catch {}

    return alerts;
  }
}
