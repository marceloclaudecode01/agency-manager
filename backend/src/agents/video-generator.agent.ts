/**
 * Video Generator Agent — Orchestrates video generation
 *
 * Provider priority:
 * 1. Cloud providers (HuggingFace / Comfy Cloud / ComfyDeploy) — if configured
 * 2. Local ffmpeg (ALWAYS available) — generates Ken Burns video from AI image
 *
 * The local ffmpeg fallback means videos are ALWAYS possible, no external API needed.
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
 * Generate video locally using ffmpeg + Pollinations AI image
 * This is the fallback that ALWAYS works — no external video API needed
 */
async function generateVideoLocally(postId: string, topic: string, message: string, category: string): Promise<boolean> {
  try {
    await agentLog('VideoGenerator', `Generating video locally via ffmpeg for "${topic}"...`, { type: 'action' });

    // 1. Generate unique AI image via Pollinations
    const image = await generateImageForPost(topic, category, message);
    if (!image.url) {
      throw new Error('Failed to generate image for video');
    }

    // 2. Convert image to video with Ken Burns effect via ffmpeg
    const { generateAndUploadVideo } = await import('../services/video-from-image.service');
    const videoUrl = await generateAndUploadVideo(image.url);

    if (!videoUrl) {
      throw new Error('Video generation returned no URL');
    }

    // 3. Update post with video URL
    await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        videoUrl,
        imageUrl: image.url, // Keep image as thumbnail
        comfyRunId: `local-ffmpeg:${Date.now()}`,
        status: 'PENDING', // Ready for governor review
      },
    });

    await agentLog('VideoGenerator', `Video ready (local ffmpeg) for "${topic}" — ${videoUrl}`, { type: 'result' });
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

    // Try cloud providers first (if any configured)
    if (isCloudConfigured()) {
      // Generate visual prompt via LLM
      const promptForLLM = `You are a world-class short-form video director. Convert this social media topic into a PRECISE visual prompt for AI text-to-video (5 seconds, no text overlays — pure cinematic footage).

RULES:
1. HOOK FRAME (0-1s): Visually striking opening — extreme close-up, dramatic reveal, pattern interrupt
2. MOVEMENT: Camera MUST move — dolly-in, orbit, crane up, tracking shot
3. LIGHTING: Dramatic — golden hour, neon contrast, rim lighting, volumetric rays
4. One clear subject, one clear action, one clear mood
5. Hyper-detailed textures, 8K photorealistic quality

Output ONLY the visual prompt in English. Max 100 words. No titles, no explanations.

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
          negative_prompt: 'blurry, low quality, text overlay, watermark, distorted, ugly, static camera, flat lighting, overexposed, underexposed, stock footage, generic, cartoon, anime, illustration, painting',
        });

        // Synchronous provider (HuggingFace) — video already ready
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

        // Async provider — store tracking ID for polling
        await prisma.scheduledPost.update({
          where: { id: postId },
          data: { comfyRunId: `${result.provider}:${result.job_id}` },
        });
        await agentLog('VideoGenerator', `Video queued via ${result.provider} for "${topicText}"`, { type: 'action' });
        return;
      } catch (cloudErr: any) {
        await agentLog('VideoGenerator', `Cloud provider failed: ${cloudErr.message}. Trying local ffmpeg...`, { type: 'error' });
      }
    }

    // Fallback: LOCAL video generation via ffmpeg (ALWAYS available)
    const category = (post as any).contentType === 'video' ? 'autoridade' : 'educativo';
    const success = await generateVideoLocally(postId, topicText, post.message, category);

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
      // Also check for PENDING_VIDEO without comfyRunId — needs local generation
      const stuckVideos = await prisma.scheduledPost.findMany({
        where: { status: 'PENDING_VIDEO', comfyRunId: null },
      });

      for (const post of stuckVideos) {
        const topicText = post.topic || post.message.substring(0, 100);
        await agentLog('VideoGenerator', `Found stuck PENDING_VIDEO post "${topicText}" — generating locally...`, { type: 'action' });
        const success = await generateVideoLocally(post.id, topicText, post.message, 'autoridade');
        if (!success) {
          await fallbackToImage(post.id);
        }
      }
      return;
    }

    for (const post of pendingVideos) {
      try {
        // Skip local-ffmpeg jobs (already completed)
        if (post.comfyRunId?.startsWith('local-ffmpeg:')) continue;

        const ageMinutes = (Date.now() - post.createdAt.getTime()) / (1000 * 60);
        if (ageMinutes > VIDEO_TIMEOUT_MINUTES) {
          // Timeout — try local generation before falling back to image
          const topicText = post.topic || post.message.substring(0, 100);
          await agentLog('VideoGenerator', `Cloud timeout for "${topicText}". Trying local ffmpeg...`, { type: 'error' });
          const success = await generateVideoLocally(post.id, topicText, post.message, 'autoridade');
          if (!success) await fallbackToImage(post.id);
          continue;
        }

        const { provider, jobId } = parseTrackingId(post.comfyRunId!);
        const status = await getRunStatus(jobId);

        if (status.status === 'completed') {
          await processCompletedVideo(post.comfyRunId!, status.outputs);
        } else if (status.status === 'failed') {
          // Cloud failed — try local before giving up
          const topicText = post.topic || post.message.substring(0, 100);
          await agentLog('VideoGenerator', `${provider} failed for "${topicText}". Trying local ffmpeg...`, { type: 'error' });
          const success = await generateVideoLocally(post.id, topicText, post.message, 'autoridade');
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

  console.log(`[VideoProcessor] Started (provider: ${provider || 'local-ffmpeg'}, polling every 2 min)`);
}
