/**
 * Video Generator Agent — Orchestrates text-to-video generation
 *
 * Dual provider: Comfy Cloud (primary) → ComfyDeploy (fallback)
 * CogVideoX-5B workflow runs on cloud GPU, no local setup needed
 *
 * 3 entry points:
 * - queueVideoForPost(postId) — called after saving post in pipeline
 * - processCompletedVideo(jobId, provider) — called by webhook or polling
 * - pollPendingVideos() — cron every 2 min, checks PENDING_VIDEO posts
 */

import cron from 'node-cron';
import prisma from '../config/database';
import { askGemini } from './gemini';
import { agentLog } from './agent-logger';
import { trackAgentExecution } from './agent-performance-tracker';
import {
  isConfigured,
  getActiveProvider,
  queueVideoGeneration,
  getRunStatus,
  getVideoOutputUrl,
} from '../services/comfydeploy.service';
import { uploadVideoFromUrl } from '../config/cloudinary';

const VIDEO_TIMEOUT_MINUTES = 15;

/**
 * Queue video generation for a post (fire-and-forget from pipeline)
 */
export async function queueVideoForPost(postId: string): Promise<void> {
  try {
    const post = await prisma.scheduledPost.findUnique({ where: { id: postId } });
    if (!post) {
      console.error(`[VideoGenerator] Post ${postId} not found`);
      return;
    }

    // Generate visual prompt via LLM — elite video director mindset
    const topicText = post.topic || post.message.substring(0, 100);
    const promptForLLM = `You are a world-class short-form video director who has generated 500M+ views across Reels, TikTok and YouTube Shorts. You think in HOOKS — the first frame must stop the scroll. You understand retention psychology: pattern interrupts, visual tension, cinematic movement, and emotional escalation.

Your job: convert this social media topic into a PRECISE visual prompt for an AI text-to-video model (5 seconds, no text/UI overlays — pure cinematic footage).

RULES FOR MAXIMUM RETENTION:
1. HOOK FRAME (0-1s): Start with an unexpected, visually striking opening — extreme close-up, dramatic reveal, or pattern interrupt. NEVER start with a static wide shot.
2. MOVEMENT (entire clip): Camera MUST move — slow dolly-in, orbit, crane up, tracking shot. Static = death. Smooth cinematic motion at all times.
3. LIGHTING: Use dramatic, moody lighting — golden hour, neon contrast, rim lighting, volumetric rays. NEVER flat/overcast lighting.
4. EMOTION: Every frame must evoke curiosity, aspiration, or awe. Think "I need to watch this again."
5. CLARITY: One clear subject, one clear action, one clear mood. No clutter, no confusion.
6. TEXTURE & DETAIL: Hyper-detailed textures — skin pores, water droplets, fabric threads, metal reflections. 8K photorealistic quality.

BAD PROMPTS (generic, boring, won't retain):
- "A person using a phone in an office" ← flat, static, zero hook
- "Beautiful landscape with mountains" ← stock footage energy

GOOD PROMPTS (specific, cinematic, scroll-stopping):
- "Extreme macro shot of espresso crema swirling in slow motion, golden light refracting through steam, camera slowly pulling back to reveal a hand lifting the cup, shallow depth of field, anamorphic lens flare"
- "Dramatic low-angle tracking shot following a businessman walking through rain-soaked neon streets at night, reflections shimmering on wet pavement, cinematic 2.39:1 aspect ratio, volumetric fog"

Output ONLY the visual prompt in English. Max 150 words. No titles, no explanations, no quotation marks. Just the raw prompt.

Topic: "${topicText}"
Post context: "${post.message.substring(0, 200)}"`;

    let visualPrompt: string;
    try {
      visualPrompt = await askGemini(promptForLLM);
      visualPrompt = visualPrompt.trim().replace(/^["']|["']$/g, '').substring(0, 500);
    } catch (llmErr: any) {
      await agentLog('VideoGenerator', `LLM prompt generation failed: ${llmErr.message}. Falling back to image.`, { type: 'error' });
      await fallbackToImage(postId);
      return;
    }

    // Queue on video provider (Comfy Cloud → ComfyDeploy fallback)
    try {
      const result = await queueVideoGeneration({
        prompt: visualPrompt,
        negative_prompt: 'blurry, low quality, text overlay, watermark, distorted, ugly, static camera, flat lighting, overexposed, underexposed, stock footage, generic, boring composition, centered subject, snapshot, amateur, grainy, noisy, cartoon, anime, illustration, painting, drawing',
      });

      // Store job_id and provider in comfyRunId (format: "provider:job_id")
      const trackingId = `${result.provider}:${result.job_id}`;

      await prisma.scheduledPost.update({
        where: { id: postId },
        data: { comfyRunId: trackingId },
      });

      await agentLog('VideoGenerator', `Video queued via ${result.provider} for "${topicText}" (job: ${result.job_id})`, { type: 'action' });
    } catch (queueErr: any) {
      await agentLog('VideoGenerator', `Video queue failed: ${queueErr.message}. Falling back to image.`, { type: 'error' });
      await fallbackToImage(postId);
    }
  } catch (err: any) {
    console.error(`[VideoGenerator] queueVideoForPost error: ${err.message}`);
    await fallbackToImage(postId).catch(() => {});
  }
}

/** Parse "provider:jobId" from comfyRunId */
function parseTrackingId(comfyRunId: string): { provider: string; jobId: string } {
  const colonIdx = comfyRunId.indexOf(':');
  if (colonIdx > 0) {
    return { provider: comfyRunId.substring(0, colonIdx), jobId: comfyRunId.substring(colonIdx + 1) };
  }
  // Legacy format (no provider prefix) — assume comfydeploy
  return { provider: 'comfydeploy', jobId: comfyRunId };
}

/**
 * Process completed video — download, upload to Cloudinary, update post
 */
export async function processCompletedVideo(comfyRunId: string, outputs?: any): Promise<void> {
  try {
    const post = await prisma.scheduledPost.findFirst({
      where: { comfyRunId },
    });

    if (!post) {
      console.error(`[VideoGenerator] No post found for tracking ID ${comfyRunId}`);
      return;
    }

    const { provider, jobId } = parseTrackingId(comfyRunId);

    // Get video URL from provider
    const videoSourceUrl = await getVideoOutputUrl(jobId, provider, outputs);

    if (!videoSourceUrl) {
      await agentLog('VideoGenerator', `No video URL from ${provider} for job ${jobId}. Falling back to image.`, { type: 'error' });
      await fallbackToImage(post.id);
      return;
    }

    // Upload to Cloudinary for permanent storage
    let finalVideoUrl: string;
    try {
      const uploaded = await uploadVideoFromUrl(videoSourceUrl, 'agency-videos');
      finalVideoUrl = uploaded.url;
      await agentLog('VideoGenerator', `Video uploaded to Cloudinary (${provider}): ${finalVideoUrl}`, { type: 'result' });
    } catch (uploadErr: any) {
      await agentLog('VideoGenerator', `Cloudinary upload failed: ${uploadErr.message}. Using source URL.`, { type: 'error' });
      finalVideoUrl = videoSourceUrl;
    }

    // Update post: videoUrl set, status back to PENDING for governor review
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: {
        videoUrl: finalVideoUrl,
        status: 'PENDING',
      },
    });

    await agentLog('VideoGenerator', `Video ready for "${post.topic}" via ${provider}. Moving to governor review.`, { type: 'result' });
  } catch (err: any) {
    console.error(`[VideoGenerator] processCompletedVideo error: ${err.message}`);
  }
}

/**
 * Poll pending videos every 2 minutes — backup for when webhook doesn't arrive
 */
export async function pollPendingVideos(): Promise<void> {
  try {
    const pendingVideos = await prisma.scheduledPost.findMany({
      where: {
        status: 'PENDING_VIDEO',
        comfyRunId: { not: null },
      },
    });

    if (pendingVideos.length === 0) return;

    for (const post of pendingVideos) {
      try {
        // Check timeout (>15 min)
        const ageMinutes = (Date.now() - post.createdAt.getTime()) / (1000 * 60);
        if (ageMinutes > VIDEO_TIMEOUT_MINUTES) {
          await agentLog('VideoGenerator', `Video timeout for "${post.topic}" (${Math.round(ageMinutes)}min). Falling back to image.`, { type: 'error' });
          await fallbackToImage(post.id);
          continue;
        }

        const { provider, jobId } = parseTrackingId(post.comfyRunId!);

        // Poll status from the correct provider
        const status = await getRunStatus(jobId);

        if (status.status === 'completed') {
          await processCompletedVideo(post.comfyRunId!, status.outputs);
        } else if (status.status === 'failed') {
          await agentLog('VideoGenerator', `${provider} job failed for "${post.topic}". Falling back to image.`, { type: 'error' });
          await fallbackToImage(post.id);
        }
        // 'pending' or 'running' — skip, wait for next poll
      } catch (pollErr: any) {
        console.error(`[VideoGenerator] Poll error for post ${post.id}: ${pollErr.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[VideoGenerator] pollPendingVideos error: ${err.message}`);
  }
}

/**
 * Fallback: convert video post to image post
 */
async function fallbackToImage(postId: string): Promise<void> {
  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      contentType: 'organic',
      status: 'PENDING',
      comfyRunId: null,
    },
  });
  await agentLog('VideoGenerator', `Post ${postId} reverted to image (fallback).`, { type: 'info' });
}

/**
 * Start video processor cron (every 2 minutes)
 * Registered in AGENT_FUNCTION_MAP as 'video-processor'
 */
export function startVideoProcessor(): void {
  const provider = getActiveProvider();
  cron.schedule('*/2 * * * *', async () => {
    await trackAgentExecution('video-processor', async () => {
      await pollPendingVideos();
    });
  });

  console.log(`[VideoProcessor] Video processor started (polling every 2 minutes, provider: ${provider || 'none'})`);
}
