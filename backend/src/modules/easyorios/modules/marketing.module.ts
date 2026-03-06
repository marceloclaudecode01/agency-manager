import { EasyoriosModule, CommandDefinition, CommandResult, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import { executeCommand, matchCommand, COMMAND_LIST } from '../../ai-chat/orion-commands';
import prisma from '../../../config/database';

export class MarketingModule implements EasyoriosModule {
  id = 'marketing';
  name = 'Marketing Digital';
  icon = 'Megaphone';
  contextPriority = 10;

  getCommands(): CommandDefinition[] {
    // Wrap existing orion-commands as a single catch-all
    return [{
      name: 'marketing_command',
      description: 'Comandos de marketing (agentes, posts, safe mode, etc.)',
      patterns: [
        // All orion-commands patterns — delegate to executeCommand
        /(?:pausar?|pause|parar?|stop|retomar|resume|reativar?|reactivate|despausar?|unpause)\s+/i,
        /(?:ativar?|activate|ligar?|enable|desativar?|deactivate|desligar?|disable)\s+(?:o\s+)?(?:safe\s*mode|modo\s*seguro)/i,
        /(?:rodar?|run|executar?|execute)\s+(?:o\s+)?sentinel/i,
        /sentinel\s+(?:scan|check|verificar?|checar?)/i,
        /(?:aprovar?|approve|rejeitar?|reject)\s+(?:o\s+)?post\s+#?\d+/i,
        /(?:status|estado)\s+(?:do\s+)?(?:sistema|system)/i,
        /system\s+status/i,
        /(?:publicar?|postar?|publish)\s+(?:agora|now|ja|já|imediato|imediatamente)/i,
        /(?:criar?|create|gerar?|generate)\s+(?:e\s+)?(?:publicar?|postar?)\s+(?:agora|now|ja|já)/i,
        /(?:manda|faz|faca|faça)\s+(?:um\s+)?(?:post|publicacao|publicação)\s+(?:agora|now|ja|já)/i,
        /(?:publicar?|postar?|agendar?|schedule)\s+(?:para|at|as|às|pra)\s+(?:as\s+)?\d{1,2}[h:]?\d{0,2}\b/i,
        /(?:alterar?|mudar?|trocar?|change|reschedule|reagendar?)\s+(?:o\s+)?(?:horario|horário|hora|time|schedule)/i,
        /(?:publicar?|postar?|publish)\s+(?:para|for|no|na|do|da)\s+(?:a?\s+)?(?:pagina|página|page|client[e]?)/i,
        /(?:listar?|list|mostrar?|show|ver)\s+(?:os?\s+)?(?:posts?\s+)?(?:pendente|pending|agendado|scheduled|fila|queue)/i,
        /(?:que|quais)\s+posts?\s+(?:estão|estao|tem|temos)\s+(?:pendente|agendado|na\s+fila)/i,
      ],
      requiredRole: 'MEMBER',
      execute: async (match, _userId) => {
        const result = await executeCommand(match.input || match[0]);
        return result || { command: 'marketing_command', success: false, message: 'Comando nao reconhecido.' };
      },
    }];
  }

  async gatherContext(_userId: string): Promise<ModuleContext> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const oneDayAgo = new Date(Date.now() - 86400000);

    const results = await Promise.allSettled([
      prisma.agent.count().catch(() => 0),
      prisma.scheduledPost.count({ where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } } }).catch(() => 0),
      prisma.scheduledPost.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.lead.count().catch(() => 0),
      prisma.agentLog.count({ where: { createdAt: { gte: oneDayAgo } } }).catch(() => 0),
      prisma.client.count({ where: { isActive: true } }).catch(() => 0),
    ]);

    const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value : 0;

    return {
      moduleId: 'marketing',
      summary: `${val(0)} agentes | ${val(1)} posts hoje | ${val(2)} pendentes | ${val(3)} leads | ${val(5)} clientes ativos`,
      metrics: {
        totalAgents: val(0),
        postsPublishedToday: val(1),
        postsPending: val(2),
        totalLeads: val(3),
        agentActions24h: val(4),
        activeClients: val(5),
      },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Status Geral', prompt: 'Qual o status geral da agencia agora?', icon: 'Activity', moduleId: 'marketing' },
      { label: 'Performance', prompt: 'Como esta a performance dos posts e engajamento?', icon: 'BarChart3', moduleId: 'marketing' },
      { label: 'Publicar Agora', prompt: 'publicar agora', icon: 'Zap', moduleId: 'marketing' },
      { label: 'Ver Fila', prompt: 'listar posts pendentes', icon: 'List', moduleId: 'marketing' },
      { label: 'Safe Mode ON', prompt: 'ativar safe mode', icon: 'Shield', moduleId: 'marketing' },
      { label: 'Safe Mode OFF', prompt: 'desativar safe mode', icon: 'ShieldOff', moduleId: 'marketing' },
    ];
  }

  async getProactiveAlerts(_userId: string): Promise<ModuleAlert[]> {
    const alerts: ModuleAlert[] = [];

    try {
      const pendingCount = await prisma.scheduledPost.count({ where: { status: 'PENDING' } });
      if (pendingCount > 10) {
        alerts.push({
          id: 'marketing-queue-high',
          moduleId: 'marketing',
          title: 'Fila de posts alta',
          message: `${pendingCount} posts pendentes na fila.`,
          severity: 'warning',
          createdAt: new Date(),
        });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const publishedToday = await prisma.scheduledPost.count({
        where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } },
      });
      if (publishedToday === 0 && new Date().getHours() >= 12) {
        alerts.push({
          id: 'marketing-no-posts-today',
          moduleId: 'marketing',
          title: 'Sem posts hoje',
          message: 'Nenhum post publicado hoje ainda. Considere publicar agora.',
          severity: 'info',
          createdAt: new Date(),
        });
      }
    } catch {}

    return alerts;
  }
}
