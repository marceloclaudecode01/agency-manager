import prisma from '../../../config/database';
import { askGemini } from '../../../agents/gemini';

export async function extractFactsFromConversation(
  userId: string,
  userMsg: string,
  assistantResponse: string,
): Promise<void> {
  try {
    const prompt = `Voce e um extrator de fatos. Analise a conversa abaixo e extraia FATOS ou PREFERENCIAS do usuario que vale a pena lembrar para futuras conversas.

Exemplos de fatos: "mora em Sao Paulo", "trabalha com marketing", "tem 2 filhos", "prefere acordar cedo"
Exemplos de preferencias: "gosta de cafe", "prefere comunicacao pelo Telegram", "nao gosta de reunioes longas"

Se NAO houver fatos ou preferencias relevantes, retorne: []

Conversa:
Usuario: ${userMsg}
Assistente: ${assistantResponse}

Retorne APENAS um JSON array de objetos:
[{"fact": "texto do fato", "category": "fact" ou "preference"}]

Se nao houver nada relevante: []`;

    const response = await askGemini(prompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const facts = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(facts) || facts.length === 0) return;

    for (const f of facts) {
      if (!f.fact || typeof f.fact !== 'string') continue;

      // Check for duplicate facts
      const existing = await prisma.conversationMemory.findFirst({
        where: {
          userId,
          category: f.category || 'fact',
          fact: { contains: f.fact.substring(0, 50), mode: 'insensitive' },
        },
      });

      if (!existing) {
        await prisma.conversationMemory.create({
          data: {
            userId,
            fact: f.fact.substring(0, 500),
            category: f.category || 'fact',
          },
        });
        console.log(`[Memory] Extracted: "${f.fact}" (${f.category})`);
      }
    }
  } catch (e: any) {
    // Fire-and-forget — don't break conversation flow
    console.error('[Memory] Extract facts error:', e.message);
  }
}

export async function getRelevantMemories(userId: string): Promise<string[]> {
  try {
    const memories = await prisma.conversationMemory.findMany({
      where: {
        userId,
        category: { in: ['fact', 'preference'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return memories.map(m => `[${m.category}] ${m.fact}`);
  } catch {
    return [];
  }
}

export async function getUserPreferences(userId: string): Promise<Record<string, string>> {
  try {
    // From UserPreference table (explicit)
    const prefs = await prisma.userPreference.findMany({
      where: { userId },
    });

    const result: Record<string, string> = {};
    for (const p of prefs) {
      result[p.key] = p.value;
    }

    // Also check inferred preferences from ConversationMemory
    const inferred = await prisma.conversationMemory.findMany({
      where: { userId, category: 'preference' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const m of inferred) {
      const key = `inferred_${m.id.substring(0, 8)}`;
      result[key] = m.fact;
    }

    return result;
  } catch {
    return {};
  }
}

export async function deduplicateFacts(userId: string): Promise<void> {
  // 1% chance per call — avoid running every time
  if (Math.random() > 0.01) return;

  try {
    const facts = await prisma.conversationMemory.findMany({
      where: { userId, category: { in: ['fact', 'preference'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (facts.length < 5) return;

    const factsText = facts.map((f, i) => `${i}: "${f.fact}"`).join('\n');

    const prompt = `Analise esta lista de fatos/preferencias e identifique DUPLICATAS ou fatos contraditorios. Retorne os INDICES dos itens que devem ser REMOVIDOS (mantenha o mais recente).

${factsText}

Retorne APENAS um JSON array de indices a remover. Ex: [3, 7, 12]
Se nao houver duplicatas: []`;

    const response = await askGemini(prompt);
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return;

    const indicesToRemove = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(indicesToRemove) || indicesToRemove.length === 0) return;

    const idsToRemove = indicesToRemove
      .filter((i: number) => i >= 0 && i < facts.length)
      .map((i: number) => facts[i].id);

    if (idsToRemove.length > 0) {
      await prisma.conversationMemory.deleteMany({
        where: { id: { in: idsToRemove } },
      });
      console.log(`[Memory] Deduplicated: removed ${idsToRemove.length} facts`);
    }
  } catch (e: any) {
    console.error('[Memory] Deduplicate error:', e.message);
  }
}

export async function forgetFact(userId: string, search: string): Promise<number> {
  try {
    const facts = await prisma.conversationMemory.findMany({
      where: {
        userId,
        category: { in: ['fact', 'preference'] },
        fact: { contains: search, mode: 'insensitive' },
      },
    });

    if (facts.length === 0) return 0;

    await prisma.conversationMemory.deleteMany({
      where: { id: { in: facts.map(f => f.id) } },
    });

    return facts.length;
  } catch {
    return 0;
  }
}
