import cron from 'node-cron';
import prisma from '../config/database';
import { askGemini } from './gemini';
import { agentLog } from './agent-logger';

const DAILY_LIMIT = 12;
const SOURCE = 'short-video-engine';

// 8 frameworks de marketing bilionário — rotação para máxima variação
const FRAMEWORKS = [
  {
    name: 'AIDA',
    prompt: 'Use o framework AIDA (Attention → Interest → Desire → Action). Hook impossível de ignorar nos primeiros 2 segundos. Estilo Apple: minimalista e poderoso.',
  },
  {
    name: 'PAS',
    prompt: 'Use o framework PAS (Problem → Agitate → Solution). Exponha uma dor visceral nos primeiros 2 segundos. Estilo Nike: empoderamento e ação.',
  },
  {
    name: 'Hero Journey Micro',
    prompt: 'Use a Jornada do Herói em micro-formato (15s): situação → desafio → transformação épica. Estilo Coca-Cola: emoção universal que conecta.',
  },
  {
    name: 'Emotional Trigger',
    prompt: 'Gatilho emocional puro (FOMO, pertencimento, aspiração). Pattern interrupt brutal nos 2 primeiros segundos. Estilo Red Bull: energia e adrenalina.',
  },
  {
    name: 'Dollar Shave Club',
    prompt: 'Humor irreverente + verdade desconfortável. Quebre a quarta parede nos 2 primeiros segundos. Tom casual mas persuasivo. Faça o viewer rir E agir.',
  },
  {
    name: 'Storytelling Pixar',
    prompt: 'Use a fórmula Pixar: "Era uma vez... Todo dia... Até que um dia... Por causa disso... Até que finalmente..." em 15 segundos. Emoção crescente.',
  },
  {
    name: 'Contrarian Hook',
    prompt: 'Comece com uma afirmação CONTRÁRIA ao senso comum que force o viewer a parar. Estilo Gary Vee: cru, direto, sem filtro. Destrua um mito popular.',
  },
  {
    name: 'Before/After Reveal',
    prompt: 'Mostre o RESULTADO primeiro (os 2 primeiros segundos), depois revele o processo. Dopamine loop: curiosity gap que prende até o final. Transformação viral.',
  },
];

async function isSafeModeActive(): Promise<boolean> {
  try {
    const config = await prisma.systemConfig.findFirst({ where: { key: 'safe_mode' } });
    return config?.value === 'true';
  } catch {
    return false;
  }
}

async function isAgentPaused(): Promise<boolean> {
  try {
    const agent = await prisma.agent.findFirst({ where: { function: SOURCE } });
    return agent?.status === 'paused';
  } catch {
    return false;
  }
}

async function getTodayVideoCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.scheduledPost.count({
    where: {
      source: SOURCE,
      createdAt: { gte: startOfDay },
    },
  });
}

function pickFramework(): (typeof FRAMEWORKS)[number] {
  return FRAMEWORKS[Math.floor(Math.random() * FRAMEWORKS.length)];
}

function getScheduledTime(): Date {
  const now = new Date();
  // Schedule 15-45 min from now (faster turnaround for video volume)
  const offsetMin = 15 + Math.floor(Math.random() * 30);
  return new Date(now.getTime() + offsetMin * 60_000);
}

async function generateShortVideoPost(): Promise<void> {
  const framework = pickFramework();

  const prompt = `Você é o diretor criativo de uma agência que atende Apple, Nike, Coca-Cola e Red Bull.
Sua missão: criar um roteiro de vídeo curto (15-30 segundos) que PARE O SCROLL e gere engajamento massivo.

${framework.prompt}

REGRAS DE OURO (das maiores agências do mundo):
- Os 2 PRIMEIROS SEGUNDOS decidem tudo — hook visual ou verbal que gera pattern interrupt
- Formato vertical (9:16), otimizado para Reels/TikTok/Shorts
- Linguagem de conversa real — como se falasse com um amigo
- Tensão narrativa: cada segundo deve fazer o viewer querer ver o próximo
- CTA específico e urgente no final (não genérico)
- Tom: autêntico, magnético, impossível de ignorar
- Use técnicas de billion-dollar brands: storytelling emocional, social proof, scarcity, curiosity gap
- PROIBIDO: corporativismo, clichês, frases genéricas, tom de vendedor

Responda EXATAMENTE neste formato JSON:
{
  "topic": "título curto do vídeo (max 60 chars)",
  "script": "roteiro completo com indicações visuais entre [colchetes]",
  "hook": "frase exata do hook dos 2 primeiros segundos",
  "cta": "call to action final específico",
  "hashtags": "5 hashtags relevantes separadas por espaço",
  "emotionalTrigger": "qual gatilho emocional principal"
}`;

  const response = await askGemini(prompt);

  let parsed: {
    topic: string;
    script: string;
    hook: string;
    cta: string;
    hashtags: string;
    emotionalTrigger: string;
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || response);
  } catch {
    console.error('[ShortVideoEngine] Failed to parse LLM response');
    await agentLog(SOURCE, 'Failed to parse LLM response', { type: 'error' });
    return;
  }

  const message = `🎬 ${parsed.hook}\n\n${parsed.script}\n\n${parsed.cta}`;
  const scheduledFor = getScheduledTime();

  await prisma.scheduledPost.create({
    data: {
      topic: parsed.topic,
      message,
      hashtags: parsed.hashtags,
      status: 'PENDING',
      source: SOURCE,
      contentType: 'video',
      scheduledFor,
    },
  });

  await agentLog(
    SOURCE,
    `Video created — Framework: ${framework.name} | Topic: ${parsed.topic} | Scheduled: ${scheduledFor.toISOString()}`,
    { type: 'action' }
  );

  console.log(`[ShortVideoEngine] Created video post: "${parsed.topic}" (${framework.name})`);
}

async function runShortVideoEngine(): Promise<void> {
  console.log('[ShortVideoEngine] Starting cycle...');

  try {
    // Note: Video engine does NOT check safe mode — videos must always be created
    if (await isAgentPaused()) {
      console.log('[ShortVideoEngine] Agent paused, skipping');
      return;
    }

    const todayCount = await getTodayVideoCount();
    if (todayCount >= DAILY_LIMIT) {
      console.log(`[ShortVideoEngine] Daily limit reached (${todayCount}/${DAILY_LIMIT})`);
      await agentLog(SOURCE, `Daily limit reached: ${todayCount}/${DAILY_LIMIT}`, { type: 'info' });
      return;
    }

    await generateShortVideoPost();

    // Update lastRunAt
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
  // Every 2 hours — high volume video production
  cron.schedule('0 */2 * * *', () => {
    runShortVideoEngine().catch(console.error);
  });
  console.log('[ShortVideoEngine] Scheduled: every 2 hours (12 videos/day max)');
}
