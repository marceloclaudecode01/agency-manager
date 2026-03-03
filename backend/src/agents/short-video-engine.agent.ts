import cron from 'node-cron';
import prisma from '../config/database';
import { askGemini } from './gemini';
import { agentLog } from './agent-logger';

const DAILY_LIMIT = 6;
const SOURCE = 'short-video-engine';

const FRAMEWORKS = [
  {
    name: 'AIDA',
    prompt: 'Use o framework AIDA (Attention → Interest → Desire → Action). Comece com um gancho impossível de ignorar nos primeiros 3 segundos.',
  },
  {
    name: 'PAS',
    prompt: 'Use o framework PAS (Problem → Agitate → Solution). Exponha uma dor real nos primeiros 3 segundos e agite antes de resolver.',
  },
  {
    name: 'Hero Journey Micro',
    prompt: 'Use a Jornada do Herói em micro-formato (15s): situação comum → desafio → transformação. Hook nos primeiros 3 segundos.',
  },
  {
    name: 'Emotional Trigger',
    prompt: 'Use gatilho emocional forte (medo de perder, pertencimento, aspiração). Pattern interrupt nos 3 primeiros segundos. CTA com urgência.',
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
  // Schedule 30-90 min from now for humanization
  const offsetMin = 30 + Math.floor(Math.random() * 60);
  return new Date(now.getTime() + offsetMin * 60_000);
}

async function generateShortVideoPost(): Promise<void> {
  const framework = pickFramework();

  const prompt = `Você é um diretor criativo de uma agência de elite (nível Apple, Nike, Coca-Cola).
Crie um roteiro de vídeo curto (15-30 segundos) para redes sociais.

${framework.prompt}

REGRAS OBRIGATÓRIAS:
- Hook nos primeiros 3 segundos (pattern interrupt visual ou frase chocante)
- Formato vertical (9:16)
- Linguagem conversacional, direta, sem corporativismo
- CTA com urgência no final
- Tom: inspirador mas autêntico

Responda EXATAMENTE neste formato JSON:
{
  "topic": "título curto do vídeo (max 60 chars)",
  "script": "roteiro completo com indicações visuais entre [colchetes]",
  "hook": "frase exata do hook dos 3 primeiros segundos",
  "cta": "call to action final",
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
    if (await isSafeModeActive()) {
      console.log('[ShortVideoEngine] Safe mode active, skipping');
      return;
    }

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
  // Every 4 hours
  cron.schedule('0 */4 * * *', () => {
    runShortVideoEngine().catch(console.error);
  });
  console.log('[ShortVideoEngine] Scheduled: every 4 hours');
}
