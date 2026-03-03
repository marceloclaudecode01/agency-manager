import cron from 'node-cron';
import prisma from '../config/database';
import { askGemini } from './gemini';
import { agentLog } from './agent-logger';
import { generateImageForPost } from './image-generator.agent';

const DAILY_LIMIT = 8;
const SOURCE = 'short-video-engine';

// 8 frameworks de marketing — rotação para máxima variação
const FRAMEWORKS = [
  {
    name: 'AIDA',
    prompt: 'Use o framework AIDA (Attention → Interest → Desire → Action). Hook impossível de ignorar. Estilo Apple: minimalista e poderoso.',
  },
  {
    name: 'PAS',
    prompt: 'Use o framework PAS (Problem → Agitate → Solution). Exponha uma dor visceral. Estilo Nike: empoderamento e ação.',
  },
  {
    name: 'Hero Journey Micro',
    prompt: 'Jornada do Herói em micro-formato: situação → desafio → transformação. Estilo Coca-Cola: emoção universal.',
  },
  {
    name: 'Emotional Trigger',
    prompt: 'Gatilho emocional puro (FOMO, pertencimento, aspiração). Pattern interrupt brutal. Estilo Red Bull: energia.',
  },
  {
    name: 'Dollar Shave Club',
    prompt: 'Humor irreverente + verdade desconfortável. Quebre a quarta parede. Tom casual mas persuasivo.',
  },
  {
    name: 'Storytelling Pixar',
    prompt: 'Fórmula Pixar: "Era uma vez... Todo dia... Até que um dia... Por causa disso... Até que finalmente..." Emoção crescente.',
  },
  {
    name: 'Contrarian Hook',
    prompt: 'Afirmação CONTRÁRIA ao senso comum. Estilo Gary Vee: cru, direto, sem filtro. Destrua um mito popular.',
  },
  {
    name: 'Before/After Reveal',
    prompt: 'Mostre o RESULTADO primeiro, depois revele o processo. Curiosity gap que prende. Transformação viral.',
  },
];

// Categorias de conteúdo para variação
const CONTENT_CATEGORIES = [
  'educativo', 'motivacional', 'engajamento', 'autoridade', 'dica_pratica', 'provocativo',
];

async function isAgentPaused(): Promise<boolean> {
  try {
    const agent = await prisma.agent.findFirst({ where: { function: SOURCE } });
    return agent?.status === 'paused';
  } catch {
    return false;
  }
}

async function getTodayCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.scheduledPost.count({
    where: { source: SOURCE, createdAt: { gte: startOfDay } },
  });
}

function pickFramework(): (typeof FRAMEWORKS)[number] {
  return FRAMEWORKS[Math.floor(Math.random() * FRAMEWORKS.length)];
}

function pickCategory(): string {
  return CONTENT_CATEGORIES[Math.floor(Math.random() * CONTENT_CATEGORIES.length)];
}

function getScheduledTime(): Date {
  const now = new Date();
  const offsetMin = 15 + Math.floor(Math.random() * 30);
  return new Date(now.getTime() + offsetMin * 60_000);
}

async function generateImagePost(): Promise<void> {
  const framework = pickFramework();

  const prompt = `Voce e o diretor criativo de uma agencia top.
Crie um post de IMAGEM para Facebook/Instagram que PARE O SCROLL.

${framework.prompt}

REGRAS:
- Texto curto e impactante (max 280 chars para a legenda principal)
- Hook poderoso na primeira linha
- NAO use emojis — texto puro e direto
- CTA especifico no final
- Tom: autentico, magnetico, brasileiro
- PROIBIDO: corporativismo, cliches, tom de vendedor, emojis, caracteres especiais unicode
- NAO inclua indicacoes de video como [colchetes] ou roteiro — e uma IMAGEM estatica
- Use apenas caracteres ASCII basicos (letras, numeros, pontuacao normal)

Responda APENAS JSON:
{
  "topic": "titulo curto (max 50 chars)",
  "caption": "legenda completa do post (max 280 chars, SEM emojis)",
  "hook": "primeira linha que para o scroll",
  "cta": "call to action final",
  "hashtags": "#hash1 #hash2 #hash3 #hash4 #hash5",
  "category": "educativo"
}`;

  const response = await askGemini(prompt);

  let parsed: {
    topic: string;
    caption: string;
    hook: string;
    cta: string;
    hashtags: string;
    category: string;
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || response);
  } catch {
    console.error('[ShortVideoEngine] Failed to parse LLM response');
    await agentLog(SOURCE, 'Failed to parse LLM response', { type: 'error' });
    return;
  }

  // Generate image from Unsplash pools (zero cost)
  const image = await generateImageForPost(parsed.topic, parsed.category || 'engajamento');

  const message = `${parsed.caption}\n\n${parsed.cta}`;
  const scheduledFor = getScheduledTime();

  await prisma.scheduledPost.create({
    data: {
      topic: parsed.topic,
      message,
      hashtags: parsed.hashtags,
      imageUrl: image.url,
      status: 'PENDING',
      source: SOURCE,
      contentType: 'image',
      scheduledFor,
    },
  });

  await agentLog(
    SOURCE,
    `Post created — Framework: ${framework.name} | Topic: ${parsed.topic} | Scheduled: ${scheduledFor.toISOString()}`,
    { type: 'action' }
  );

  console.log(`[ShortVideoEngine] Created image post: "${parsed.topic}" (${framework.name})`);
}

export async function runShortVideoEngine(): Promise<void> {
  console.log('[ShortVideoEngine] Starting cycle...');

  try {
    if (await isAgentPaused()) {
      console.log('[ShortVideoEngine] Agent paused, skipping');
      return;
    }

    const todayCount = await getTodayCount();
    if (todayCount >= DAILY_LIMIT) {
      console.log(`[ShortVideoEngine] Daily limit reached (${todayCount}/${DAILY_LIMIT})`);
      await agentLog(SOURCE, `Daily limit reached: ${todayCount}/${DAILY_LIMIT}`, { type: 'info' });
      return;
    }

    await generateImagePost();

    await prisma.agent.updateMany({
      where: { function: SOURCE },
      data: { lastRunAt: new Date() },
    });

    console.log('[ShortVideoEngine] Cycle complete');
  } catch (error: any) {
    console.error('[ShortVideoEngine] Error:', error.message);
    await agentLog(SOURCE, error.message, { type: 'error' }).catch(() => {});
  }
}

export function startShortVideoEngine(): void {
  // Every 3 hours — 8 image posts/day max
  cron.schedule('0 */3 * * *', () => {
    runShortVideoEngine().catch(console.error);
  });
  console.log('[ShortVideoEngine] Scheduled: every 3 hours (8 posts/day max)');
}
