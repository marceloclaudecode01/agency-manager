/**
 * Video Intelligence Service — Self-Evolving Video Production
 *
 * Learns from engagement data to improve every new video:
 * - Tracks which Ken Burns effect, music mood, image style performs best
 * - Weighted random selection (better performers get picked more)
 * - Integrates with Performance Learner, Brand Brain, Viral Mechanics
 * - Stores learned weights in SystemConfig (persists across restarts)
 *
 * Evolution cycle:
 * 1. Video created → metadata saved (effect, mood, category, imageSource)
 * 2. Performance Learner collects engagement 48h later
 * 3. Video Intelligence analyzes video-specific performance
 * 4. Weights updated — winning combos get higher probability
 * 5. Next video uses evolved weights for selection
 *
 * Zero extra tokens. Zero extra API calls. Pure data-driven evolution.
 */

import prisma from '../config/database';
import { agentLog } from '../agents/agent-logger';

// ─── Types ───────────────────────────────────────────────────

export interface VideoMetadata {
  effectIndex: number;
  effectName: string;
  musicMood: string;
  category: string;
  imageSource: string; // 'pollinations-flux', 'picsum-fallback', 'existing', etc.
  hookLength: number;
  ctaLength: number;
  videoDuration: number;
  fileSize: number;
}

interface EffectWeight {
  index: number;
  name: string;
  weight: number; // 0.1 to 5.0 — higher = more likely to be picked
  uses: number;
  avgEngagement: number;
}

interface MoodWeight {
  mood: string;
  weight: number;
  uses: number;
  avgEngagement: number;
}

interface VideoWeights {
  effects: EffectWeight[];
  moods: MoodWeight[];
  bestCombos: Array<{
    effect: string;
    mood: string;
    avgScore: number;
    count: number;
  }>;
  totalVideos: number;
  lastEvolution: string;
  generation: number; // Evolution generation counter
}

// ─── Effect Names (match video-from-text.service.ts order) ───

const EFFECT_NAMES = [
  'spielberg-zoom-in',
  'nolan-wide-reveal',
  'documentary-pan-lr',
  'editorial-pan-rl',
  'macro-top-focus',
  'editorial-bottom-reveal',
  'cinematic-diagonal',
  'apple-aspirational',
  'redbull-intensity',
  'luxury-golden-ratio',
];

const MOOD_NAMES = [
  'calm-ambient',
  'uplifting',
  'confident-deep',
  'energetic',
  'dramatic',
  'light-friendly',
];

const CONFIG_KEY = 'video_intelligence_weights';

// ─── Load / Save Weights ─────────────────────────────────────

async function loadWeights(): Promise<VideoWeights> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
    if (config?.value) return config.value as any as VideoWeights;
  } catch {}

  // Initialize default weights (all equal)
  return {
    effects: EFFECT_NAMES.map((name, index) => ({
      index, name, weight: 1.0, uses: 0, avgEngagement: 0,
    })),
    moods: MOOD_NAMES.map(mood => ({
      mood, weight: 1.0, uses: 0, avgEngagement: 0,
    })),
    bestCombos: [],
    totalVideos: 0,
    lastEvolution: new Date().toISOString(),
    generation: 0,
  };
}

async function saveWeights(weights: VideoWeights): Promise<void> {
  try {
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: weights as any },
      create: { key: CONFIG_KEY, value: weights as any },
    });
  } catch (err: any) {
    console.error(`[VideoIntelligence] Failed to save weights: ${err.message}`);
  }
}

// ─── Weighted Random Selection ───────────────────────────────

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Get the best effect index based on learned performance data.
 * Uses weighted random — higher performing effects have more chance.
 */
export async function getSmartEffectIndex(): Promise<{ index: number; name: string }> {
  const weights = await loadWeights();
  const selected = weightedRandom(weights.effects);
  return { index: selected.index, name: selected.name };
}

/**
 * Get the best music mood for a category based on learned data.
 * Falls back to category default if no data yet.
 */
export async function getSmartMusicMood(category: string): Promise<string> {
  const weights = await loadWeights();

  // Check if we have data for this specific category combo
  const categoryMoods = weights.bestCombos
    .filter(c => c.mood && c.count >= 3)
    .sort((a, b) => b.avgScore - a.avgScore);

  if (categoryMoods.length > 0 && Math.random() < 0.7) {
    // 70% chance: use best known combo
    return categoryMoods[0].mood;
  }

  // Otherwise: weighted random across all moods (exploration)
  const moodWeights = weights.moods.filter(m => m.weight > 0);
  if (moodWeights.length > 0) {
    return weightedRandom(moodWeights).mood;
  }

  return category; // default: mood matches category name
}

/**
 * Record video metadata after creation (for later learning)
 */
export async function recordVideoCreation(
  postId: string,
  metadata: VideoMetadata
): Promise<void> {
  try {
    // Store as video_meta in comfyRunId field's JSON (piggyback on existing field)
    // or use AgentLog for tracking
    await agentLog('VideoIntelligence', `Video created: effect=${metadata.effectName}, mood=${metadata.musicMood}, cat=${metadata.category}, size=${(metadata.fileSize / 1024).toFixed(0)}KB`, {
      type: 'info',
      payload: { postId, ...metadata },
    });

    // Update usage counters
    const weights = await loadWeights();
    const effect = weights.effects.find(e => e.index === metadata.effectIndex);
    if (effect) effect.uses++;
    const mood = weights.moods.find(m => m.mood === metadata.musicMood);
    if (mood) mood.uses++;
    weights.totalVideos++;
    await saveWeights(weights);
  } catch (err: any) {
    console.error(`[VideoIntelligence] Record failed: ${err.message}`);
  }
}

/**
 * Evolve video weights based on performance data.
 * Called by Performance Learner after collecting engagement metrics.
 *
 * Algorithm:
 * 1. Get all video posts with engagement data from last 30 days
 * 2. Parse effect/mood metadata from AgentLog
 * 3. Calculate avg engagement per effect and per mood
 * 4. Update weights: good performers get boosted, bad ones get reduced
 * 5. Never drop below 0.1 (always keep some exploration)
 */
export async function evolveVideoWeights(): Promise<{
  generation: number;
  effectsUpdated: number;
  moodsUpdated: number;
  topEffect: string;
  topMood: string;
}> {
  const weights = await loadWeights();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get video creation logs with payload metadata
  const videoLogs = await prisma.agentLog.findMany({
    where: {
      from: 'VideoIntelligence',
      message: { startsWith: 'Video created:' },
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { message: true, payload: true, createdAt: true },
  });

  // Get performance data for video posts
  const videoPerf = await prisma.contentPerformance.findMany({
    where: {
      contentType: 'video',
      createdAt: { gte: thirtyDaysAgo },
      engagementScore: { gt: 0 },
    },
  });

  if (videoPerf.length < 5) {
    // Not enough data to evolve yet
    await agentLog('VideoIntelligence', `Not enough video performance data (${videoPerf.length}/5). Skipping evolution.`, { type: 'info' });
    return { generation: weights.generation, effectsUpdated: 0, moodsUpdated: 0, topEffect: 'n/a', topMood: 'n/a' };
  }

  // Parse metadata from logs
  const effectScores = new Map<string, number[]>();
  const moodScores = new Map<string, number[]>();

  for (const log of videoLogs) {
    const meta = log.payload as any;
    if (!meta?.postId) continue;

    // Find matching performance
    const perf = videoPerf.find(p => p.postId === meta.postId);
    if (!perf) continue;

    const score = perf.engagementScore;

    if (meta.effectName) {
      if (!effectScores.has(meta.effectName)) effectScores.set(meta.effectName, []);
      effectScores.get(meta.effectName)!.push(score);
    }

    if (meta.musicMood) {
      if (!moodScores.has(meta.musicMood)) moodScores.set(meta.musicMood, []);
      moodScores.get(meta.musicMood)!.push(score);
    }
  }

  // Calculate global average
  const allScores = videoPerf.map(p => p.engagementScore);
  const globalAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;

  let effectsUpdated = 0;
  let moodsUpdated = 0;

  // Update effect weights
  for (const effect of weights.effects) {
    const scores = effectScores.get(effect.name);
    if (scores && scores.length >= 2) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      effect.avgEngagement = avg;

      // Weight = performance ratio vs global average
      // Good: 1.5x avg → weight 1.5, Bad: 0.5x avg → weight 0.5
      const ratio = globalAvg > 0 ? avg / globalAvg : 1;
      effect.weight = Math.max(0.1, Math.min(5.0, ratio));
      effectsUpdated++;
    }
  }

  // Update mood weights
  for (const mood of weights.moods) {
    const scores = moodScores.get(mood.mood);
    if (scores && scores.length >= 2) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      mood.avgEngagement = avg;

      const ratio = globalAvg > 0 ? avg / globalAvg : 1;
      mood.weight = Math.max(0.1, Math.min(5.0, ratio));
      moodsUpdated++;
    }
  }

  // Track best combos
  const comboMap = new Map<string, { scores: number[]; effect: string; mood: string }>();
  for (const log of videoLogs) {
    const meta = log.payload as any;
    if (!meta?.postId || !meta?.effectName || !meta?.musicMood) continue;
    const perf = videoPerf.find(p => p.postId === meta.postId);
    if (!perf) continue;
    const key = `${meta.effectName}|${meta.musicMood}`;
    if (!comboMap.has(key)) comboMap.set(key, { scores: [], effect: meta.effectName, mood: meta.musicMood });
    comboMap.get(key)!.scores.push(perf.engagementScore);
  }

  weights.bestCombos = Array.from(comboMap.values())
    .map(c => ({
      effect: c.effect,
      mood: c.mood,
      avgScore: c.scores.reduce((a, b) => a + b, 0) / c.scores.length,
      count: c.scores.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 20);

  // Increment generation
  weights.generation++;
  weights.lastEvolution = new Date().toISOString();
  await saveWeights(weights);

  const topEffect = [...weights.effects].sort((a, b) => b.weight - a.weight)[0]?.name || 'n/a';
  const topMood = [...weights.moods].sort((a, b) => b.weight - a.weight)[0]?.mood || 'n/a';

  await agentLog('VideoIntelligence', `Evolution gen ${weights.generation}: ${effectsUpdated} effects, ${moodsUpdated} moods updated. Top: ${topEffect} + ${topMood}. Data: ${videoPerf.length} videos.`, { type: 'result' });

  return { generation: weights.generation, effectsUpdated, moodsUpdated, topEffect, topMood };
}

/**
 * Get current intelligence status (for debugging/monitoring)
 */
export async function getVideoIntelligenceStatus(): Promise<VideoWeights> {
  return loadWeights();
}
