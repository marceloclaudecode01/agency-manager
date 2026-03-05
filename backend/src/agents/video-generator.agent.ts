/**
 * Video Generator Agent v3 — Cinematic Ken Burns + Music
 *
 * Pipeline priority:
 * 1. Cloud providers (HuggingFace / ComfyDeploy) — if configured
 * 2. Premium local (Ken Burns + text overlay + ambient music) — ALWAYS available
 *
 * Uses video-from-text.service v3 which integrates:
 * - Ken Burns cinematic effects (10 styles: Spielberg, Nolan, Apple, etc.)
 * - Gradient overlay for text readability
 * - Text overlay (hook + CTA) with shadow
 * - Ambient music matched to content category (procedurally generated, royalty-free)
 *
 * No external API needed for local generation. Zero tokens. Zero internet (after image download).
 */

import cron from 'node-cron';
import prisma from '../config/database';
import { askGemini } from './gemini';
import { agentLog } from './agent-logger';
import { trackAgentExecution } from './agent-performance-tracker';
import {
  isConfigured as isCloudConfigured,
  getActiveProvider,
  queueVideoGeneration,
  getRunStatus,
  getVideoOutputUrl,
} from '../services/comfydeploy.service';
import { uploadVideoFromUrl } from '../config/cloudinary';
import { generateImageForPost } from './image-generator.agent';

const VIDEO_TIMEOUT_MINUTES = 15;

/**
 * Generate video locally using the premium pipeline:
 * Image (AI-generated if needed) → Ken Burns → gradient overlay → text → ambient music → MP4
 *
 * ALWAYS uses an image background. If no imageUrl provided, generates one
 * via Pollinations AI based on the post topic/category.
 */
async function generateVideoLocally(
  postId: string,
  topic: string,
  message: string,
  category: string,
  existingImageUrl?: string
): Promise<boolean> {
  try {
    // ALWAYS ensure we have an image — generate one if not provided
    let imageUrl = existingImageUrl;
    if (!imageUrl) {
      await agentLog('VideoGenerator', `No image for "${topic}" — generating AI image...`, { type: 'action' });
      try {
        const generated = await generateImageForPost(topic, category, message);
        imageUrl = generated.url;
        await agentLog('VideoGenerator', `AI image generated via ${generated.source} for "${topic}"`, { type: 'info' });
      } catch (imgErr: any) {
        await agentLog('VideoGenerator', `Image generation failed: ${imgErr.message}. Using Picsum fallback.`, { type: 'error' });
        imageUrl = `https://picsum.photos/seed/${Date.now()}/1080/1920`;
      }
    }

    await agentLog('VideoGenerator', `Generating cinematic video for "${topic}" [${category}]...`, { type: 'action' });

    const { generateAndUploadPremiumVideo } = await import('../services/video-from-text.service');
    const videoUrl = await generateAndUploadPremiumVideo(message, topic, category, imageUrl);

    if (!videoUrl) {
      throw new Error('Video generation returned no URL');
    }

    await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        videoUrl,
        imageUrl: existingImageUrl || null,
        comfyRunId: `local-premium:${Date.now()}`,
        status: 'PENDING',
      },
    });

    const mode = existingImageUrl ? 'Ken Burns + image' : 'dark bg';
    await agentLog('VideoGenerator', `Video ready for "${topic}" (${mode}, ${category} mood) — ${videoUrl}`, { type: 'result' });
    return true;
  } catch (err: any) {
    await agentLog('VideoGenerator', `Local video generation failed: ${err.message}`, { type: 'error' });
    return false;
  }
}

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

    const topicText = post.topic || post.message.substring(0, 100);
    const category = (post as any).category || 'educativo';

    // Try cloud providers first (if any configured)
    if (isCloudConfigured()) {
      const promptForLLM = `You are the Senior Video Director at a billion-dollar creative agency. Your work is indistinguishable from Super Bowl commercials, Apple product reveals, and Netflix documentary cinematography.

Convert this social media topic into a CINEMATIC visual prompt for AI text-to-video (5 seconds, zero text overlays — pure visual storytelling).

BILLION-DOLLAR CREATIVE PRINCIPLES:
1. HOOK FRAME (0-1s): The opening frame must be so visually arresting that scrolling becomes physically impossible.
2. CAMERA LANGUAGE: Every movement tells a story — Spielberg dolly-in, Kubrick symmetry, Fincher tracking shot.
3. LIGHTING AS CHARACTER: Rembrandt triangle for drama, rim lighting for mystery, volumetric god rays for epic scale.
4. EMOTION OVER INFORMATION: The viewer must FEEL something in 5 seconds.
5. PREMIUM TEXTURE: 8K IMAX quality.
6. COLOR STORY: Deliberate palette.

Output ONLY the visual prompt in English. Max 120 words.

Topic: "${topicText}"
Post: "${post.message.substring(0, 200)}"`;

      let visualPrompt: string;
      try {
        visualPrompt = await askGemini(promptForLLM);
        visualPrompt = visualPrompt.trim().replace(/^["']|["']$/g, '').substring(0, 500);
      } catch {
        visualPrompt = `Cinematic close-up shot related to ${topicText}, dramatic lighting, slow camera movement`;
      }

      try {
        const result = await queueVideoGeneration({
          prompt: visualPrompt,
          negative_prompt: 'blurry, low quality, text overlay, watermark, distorted, ugly, static camera, flat lighting, overexposed, underexposed, stock footage look, generic corporate, amateur, cartoon, anime',
        });

        if (result.videoUrl) {
          await prisma.scheduledPost.update({
            where: { id: postId },
            data: {
              videoUrl: result.videoUrl,
              comfyRunId: `${result.provider}:${result.job_id}`,
              status: 'PENDING',
            },
          });
          await agentLog('VideoGenerator', `Video ready via ${result.provider} for "${topicText}"`, { type: 'result' });
          return;
        }

        await prisma.scheduledPost.update({
          where: { id: postId },
          data: { comfyRunId: `${result.provider}:${result.job_id}` },
        });
        await agentLog('VideoGenerator', `Video queued via ${result.provider} for "${topicText}"`, { type: 'action' });
        return;
      } catch (cloudErr: any) {
        await agentLog('VideoGenerator', `Cloud provider failed: ${cloudErr.message}. Using local premium...`, { type: 'error' });
      }
    }

    // LOCAL premium generation (Ken Burns + text + music)
    const success = await generateVideoLocally(postId, topicText, post.message, category, post.imageUrl || undefined);

    if (!success) {
      await agentLog('VideoGenerator', `All video methods failed for "${topicText}". Falling back to image.`, { type: 'error' });
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
  return { provider: 'comfydeploy', jobId: comfyRunId };
}

/**
 * Process completed video — download, upload to Cloudinary, update post
 */
export async function processCompletedVideo(comfyRunId: string, outputs?: any): Promise<void> {
  try {
    const post = await prisma.scheduledPost.findFirst({ where: { comfyRunId } });
    if (!post) {
      console.error(`[VideoGenerator] No post found for tracking ID ${comfyRunId}`);
      return;
    }

    const { provider, jobId } = parseTrackingId(comfyRunId);
    const videoSourceUrl = await getVideoOutputUrl(jobId, provider, outputs);

    if (!videoSourceUrl) {
      await agentLog('VideoGenerator', `No video URL from ${provider}. Falling back to image.`, { type: 'error' });
      await fallbackToImage(post.id);
      return;
    }

    let finalVideoUrl: string;
    try {
      const uploaded = await uploadVideoFromUrl(videoSourceUrl, 'agency-videos');
      finalVideoUrl = uploaded.url;
    } catch (uploadErr: any) {
      await agentLog('VideoGenerator', `Cloudinary upload failed: ${uploadErr.message}. Using source URL.`, { type: 'error' });
      finalVideoUrl = videoSourceUrl;
    }

    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { videoUrl: finalVideoUrl, status: 'PENDING' },
    });

    await agentLog('VideoGenerator', `Video ready for "${post.topic}" via ${provider}.`, { type: 'result' });
  } catch (err: any) {
    console.error(`[VideoGenerator] processCompletedVideo error: ${err.message}`);
  }
}

/**
 * Poll pending videos every 2 minutes
 */
export async function pollPendingVideos(): Promise<void> {
  try {
    const pendingVideos = await prisma.scheduledPost.findMany({
      where: { status: 'PENDING_VIDEO', comfyRunId: { not: null } },
    });

    if (pendingVideos.length === 0) {
      // Discard old PENDING_VIDEO posts (>1 hour old)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const discarded = await prisma.scheduledPost.updateMany({
        where: { status: 'PENDING_VIDEO', comfyRunId: null, createdAt: { lt: oneHourAgo } },
        data: { contentType: 'organic', status: 'PENDING', comfyRunId: null },
      });
      if (discarded.count > 0) {
        console.log(`[VideoProcessor] Discarded ${discarded.count} old PENDING_VIDEO posts (>1h old)`);
      }

      // Process 1 fresh stuck video per cycle
      const stuckVideos = await prisma.scheduledPost.findMany({
        where: { status: 'PENDING_VIDEO', comfyRunId: null, createdAt: { gte: oneHourAgo } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      for (const post of stuckVideos) {
        const topicText = post.topic || post.message.substring(0, 100);
        const category = (post as any).category || 'autoridade';
        await agentLog('VideoGenerator', `Processing stuck PENDING_VIDEO "${topicText}" — local premium...`, { type: 'action' });
        const success = await generateVideoLocally(post.id, topicText, post.message, category, post.imageUrl || undefined);
        if (!success) await fallbackToImage(post.id);
      }
      return;
    }

    for (const post of pendingVideos) {
      try {
        if (post.comfyRunId?.startsWith('local-premium:') || post.comfyRunId?.startsWith('local-ffmpeg:')) continue;

        const ageMinutes = (Date.now() - post.createdAt.getTime()) / (1000 * 60);
        if (ageMinutes > VIDEO_TIMEOUT_MINUTES) {
          const topicText = post.topic || post.message.substring(0, 100);
          const category = (post as any).category || 'autoridade';
          await agentLog('VideoGenerator', `Cloud timeout for "${topicText}". Using local premium...`, { type: 'error' });
          const success = await generateVideoLocally(post.id, topicText, post.message, category);
          if (!success) await fallbackToImage(post.id);
          continue;
        }

        const { provider, jobId } = parseTrackingId(post.comfyRunId!);
        const status = await getRunStatus(jobId);

        if (status.status === 'completed') {
          await processCompletedVideo(post.comfyRunId!, status.outputs);
        } else if (status.status === 'failed') {
          const topicText = post.topic || post.message.substring(0, 100);
          const category = (post as any).category || 'autoridade';
          await agentLog('VideoGenerator', `${provider} failed for "${topicText}". Using local premium...`, { type: 'error' });
          const success = await generateVideoLocally(post.id, topicText, post.message, category);
          if (!success) await fallbackToImage(post.id);
        }
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
    data: { contentType: 'organic', status: 'PENDING', comfyRunId: null },
  });
  await agentLog('VideoGenerator', `Post ${postId} reverted to image (fallback).`, { type: 'info' });
}

/**
 * Start video processor cron (every 2 minutes)
 */
export function startVideoProcessor(): void {
  const provider = getActiveProvider();
  cron.schedule('*/2 * * * *', async () => {
    await trackAgentExecution('video-processor', async () => {
      await pollPendingVideos();
    });
  });

  console.log(`[VideoProcessor] Started v3 (provider: ${provider || 'local-premium'}, Ken Burns + music, polling every 2 min)`);
}
