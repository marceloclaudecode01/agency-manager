import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import { getRelevantMemories, forgetFact } from '../core/memory-engine';
import prisma from '../../../config/database';

export class MemoryModule implements EasyoriosModule {
  id = 'memory';
  name = 'Memoria';
  icon = 'Brain';
  contextPriority = 11;

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'what_you_know',
        description: 'Ver o que o Easyorios sabe sobre voce',
        patterns: [
          /(?:o\s+que\s+(?:voce|vc)\s+sabe)\s+(?:sobre\s+mim|de\s+mim)/i,
          /(?:minhas?\s+)?(?:memorias?|lembrancas?|fatos?)/i,
          /(?:what\s+(?:do\s+)?you\s+know)\s+(?:about\s+me)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const memories = await getRelevantMemories(userId);

          if (memories.length === 0) {
            return {
              command: 'what_you_know',
              success: true,
              message: 'Ainda nao tenho fatos memorizados sobre voce. Conforme conversamos, vou aprender automaticamente!',
            };
          }

          const facts = memories.filter(m => m.startsWith('[fact]'));
          const prefs = memories.filter(m => m.startsWith('[preference]'));

          const parts: string[] = ['**O que eu sei sobre voce:**\n'];

          if (facts.length > 0) {
            parts.push('**Fatos:**');
            facts.forEach(f => parts.push(`- ${f.replace('[fact] ', '')}`));
          }

          if (prefs.length > 0) {
            parts.push('\n**Preferencias:**');
            prefs.forEach(p => parts.push(`- ${p.replace('[preference] ', '')}`));
          }

          // Also show explicit preferences
          try {
            const explicit = await prisma.userPreference.findMany({ where: { userId } });
            if (explicit.length > 0) {
              parts.push('\n**Configuracoes:**');
              explicit.forEach(p => parts.push(`- ${p.key}: ${p.value}`));
            }
          } catch {}

          return {
            command: 'what_you_know',
            success: true,
            message: parts.join('\n'),
            data: { totalFacts: facts.length, totalPreferences: prefs.length },
          };
        },
      },
      {
        name: 'forget_fact',
        description: 'Esquecer um fato memorizado',
        patterns: [
          /(?:esqueca|esqueça|forget|apaga[r]?\s+(?:fato|memoria))\s+(?:que\s+(?:eu\s+)?)?(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const search = (match[1] || '').trim();
          if (!search) {
            return { command: 'forget_fact', success: false, message: 'Informe o que deseja que eu esqueca.' };
          }

          const removed = await forgetFact(userId, search);

          if (removed === 0) {
            return { command: 'forget_fact', success: false, message: `Nao encontrei nenhuma memoria sobre "${search}".` };
          }

          return {
            command: 'forget_fact',
            success: true,
            message: `Feito! Esqueci ${removed} fato(s) relacionados a "${search}".`,
          };
        },
      },
    ];
  }

  async gatherContext(userId: string): Promise<ModuleContext> {
    let factCount = 0;
    let prefCount = 0;
    try {
      factCount = await prisma.conversationMemory.count({
        where: { userId, category: 'fact' },
      });
      prefCount = await prisma.conversationMemory.count({
        where: { userId, category: 'preference' },
      });
    } catch {}

    return {
      moduleId: 'memory',
      summary: `${factCount} fatos + ${prefCount} preferencias memorizadas`,
      metrics: { facts: factCount, preferences: prefCount },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'O que voce sabe?', prompt: 'o que voce sabe sobre mim', icon: 'Brain', moduleId: 'memory' },
    ];
  }

  async getProactiveAlerts(_userId: string): Promise<ModuleAlert[]> {
    return [];
  }
}
