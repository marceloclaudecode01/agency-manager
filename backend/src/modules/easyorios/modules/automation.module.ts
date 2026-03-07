import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import { askGemini } from '../../../agents/gemini';
import prisma from '../../../config/database';

export class AutomationModule implements EasyoriosModule {
  id = 'automation';
  name = 'Automacoes';
  icon = 'Zap';
  contextPriority = 11;

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'list_rules',
        description: 'Listar regras de automacao',
        patterns: [
          /(?:minhas?\s+)?(?:regras?|automac[oõ]es?|rules?)/i,
          /(?:listar?|ver|mostrar?)\s+(?:regras?|automac[oõ]es?)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const rules = await prisma.automationRule.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          });

          if (rules.length === 0) {
            return {
              command: 'list_rules',
              success: true,
              message: 'Nenhuma regra de automacao. Use "cria regra quando gastos > 3000 avise no telegram" para criar.',
            };
          }

          const lines = rules.map(r => {
            const status = r.enabled ? 'ativa' : 'desativada';
            const triggers = r.triggerCount || 0;
            return `- **${r.name}** (${status}) — ${r.description || r.triggerType} | Disparos: ${triggers}`;
          });

          return {
            command: 'list_rules',
            success: true,
            message: `**Regras de Automacao (${rules.length}):**\n${lines.join('\n')}`,
          };
        },
      },
      {
        name: 'create_rule',
        description: 'Criar regra de automacao via linguagem natural',
        patterns: [
          /(?:cria[r]?\s+regra|nova?\s+regra|create\s+rule)\s+(.+)/i,
        ],
        requiredRole: 'ADMIN',
        execute: async (match, userId) => {
          const description = (match[1] || '').trim();
          if (!description) {
            return { command: 'create_rule', success: false, message: 'Descreva a regra. Ex: "cria regra quando gastos > 3000 avise no telegram"' };
          }

          try {
            const prompt = `Voce e um parser de regras de automacao. Extraia a regra a partir da descricao do usuario.

Modulos disponiveis e suas metricas:
- marketing: totalPosts, avgEngagement, publishedToday
- finance: monthlyExpenses, monthlyIncome, balance
- personal: pendingReminders, pendingTodos
- smarthome: activeDevices
- search: activeCacheEntries

Tipos de acao: "alert", "telegram_message", "command", "task_template"
Operadores: "gt" (maior que), "lt" (menor que), "gte" (maior ou igual), "lte" (menor ou igual), "eq" (igual)

Descricao do usuario: "${description}"

Responda APENAS em JSON valido:
{"name": "nome curto", "description": "descricao", "triggerType": "metric_threshold", "triggerConfig": {"moduleId": "x", "metric": "y", "operator": "gt", "threshold": 100}, "actionType": "alert", "actionConfig": {"message": "texto"}, "cooldownMinutes": 60}`;

            const response = await askGemini(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('LLM nao retornou JSON valido');

            const parsed = JSON.parse(jsonMatch[0]);

            await prisma.automationRule.create({
              data: {
                userId,
                name: parsed.name || 'Regra personalizada',
                description: parsed.description || description,
                triggerType: parsed.triggerType || 'metric_threshold',
                triggerConfig: parsed.triggerConfig,
                actionType: parsed.actionType || 'alert',
                actionConfig: parsed.actionConfig || { message: description },
                cooldownMinutes: parsed.cooldownMinutes || 60,
              },
            });

            return {
              command: 'create_rule',
              success: true,
              message: `Regra criada: **${parsed.name}** — ${parsed.description || description}`,
            };
          } catch (e: any) {
            return { command: 'create_rule', success: false, message: `Erro ao criar regra: ${e.message}` };
          }
        },
      },
      {
        name: 'disable_rule',
        description: 'Desativar regra de automacao',
        patterns: [
          /(?:desativa[r]?|disable|pausa[r]?)\s+regra\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const search = (match[1] || '').trim();
          const rule = await prisma.automationRule.findFirst({
            where: { userId, name: { contains: search, mode: 'insensitive' } },
          });
          if (!rule) return { command: 'disable_rule', success: false, message: `Regra "${search}" nao encontrada.` };

          await prisma.automationRule.update({
            where: { id: rule.id },
            data: { enabled: false },
          });

          return { command: 'disable_rule', success: true, message: `Regra "${rule.name}" desativada.` };
        },
      },
      {
        name: 'enable_rule',
        description: 'Ativar regra de automacao',
        patterns: [
          /(?:ativa[r]?|enable)\s+regra\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const search = (match[1] || '').trim();
          const rule = await prisma.automationRule.findFirst({
            where: { userId, name: { contains: search, mode: 'insensitive' } },
          });
          if (!rule) return { command: 'enable_rule', success: false, message: `Regra "${search}" nao encontrada.` };

          await prisma.automationRule.update({
            where: { id: rule.id },
            data: { enabled: true },
          });

          return { command: 'enable_rule', success: true, message: `Regra "${rule.name}" ativada.` };
        },
      },
      {
        name: 'delete_rule',
        description: 'Excluir regra de automacao',
        patterns: [
          /(?:excluir?|deleta[r]?|remove[r]?)\s+regra\s+(.+)/i,
        ],
        requiredRole: 'ADMIN',
        execute: async (match, userId) => {
          const search = (match[1] || '').trim();
          const rule = await prisma.automationRule.findFirst({
            where: { userId, name: { contains: search, mode: 'insensitive' } },
          });
          if (!rule) return { command: 'delete_rule', success: false, message: `Regra "${search}" nao encontrada.` };

          await prisma.automationRule.delete({ where: { id: rule.id } });

          return { command: 'delete_rule', success: true, message: `Regra "${rule.name}" excluida.` };
        },
      },
    ];
  }

  async gatherContext(userId: string): Promise<ModuleContext> {
    let activeRules = 0;
    let totalTriggers = 0;
    try {
      const rules = await prisma.automationRule.findMany({
        where: { userId },
        select: { enabled: true, triggerCount: true },
      });
      activeRules = rules.filter(r => r.enabled).length;
      totalTriggers = rules.reduce((sum, r) => sum + r.triggerCount, 0);
    } catch {}

    return {
      moduleId: 'automation',
      summary: `${activeRules} regras ativas | ${totalTriggers} disparos total`,
      metrics: { activeRules, totalTriggers },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Minhas Regras', prompt: 'minhas regras', icon: 'Zap', moduleId: 'automation' },
    ];
  }

  async getProactiveAlerts(_userId: string): Promise<ModuleAlert[]> {
    return [];
  }
}
