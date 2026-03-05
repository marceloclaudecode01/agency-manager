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
async function generateVideoLocally(postId: string, topic: string, message: string, category: string, existingImageUrl?: string): Promise<boolean> {
  try {
    await agentLog('VideoGenerator', `Generating video locally via ffmpeg for "${topic}"...`, { type: 'action' });

    // 1. Use existing image if available, otherwise generate new one
    let imageUrl: string;
    if (existingImageUrl) {
      imageUrl = existingImageUrl;
      await agentLog('VideoGenerator', `Using existing image for video: ${imageUrl.substring(0, 80)}...`, { type: 'info' });
    } else {
      const image = await generateImageForPost(topic, category, message);
      if (!image.url) {
        throw new Error('Failed to generate image for video');
      }
      imageUrl = image.url;
    }

    // 2. Convert image to video with Ken Burns effect via ffmpeg
    const { generateAndUploadVideo } = await import('../services/video-from-image.service');
    const videoUrl = await generateAndUploadVideo(imageUrl);

    if (!videoUrl) {
      throw new Error('Video generation returned no URL');
    }

    // 3. Update post with video URL
    await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        videoUrl,
        imageUrl: imageUrl, // Keep image as thumbnail
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
      const promptForLLM = `You are the Senior Video Director at a billion-dollar creative agency. Your work is indistinguishable from Super Bowl commercials, Apple product reveals, and Netflix documentary cinematography.

Convert this social media topic into a CINEMATIC visual prompt for AI text-to-video (5 seconds, zero text overlays — pure visual storytelling).

BILLION-DOLLAR CREATIVE PRINCIPLES:
1. HOOK FRAME (0-1s): The opening frame must be so visually arresting that scrolling becomes physically impossible. Think: extreme macro revealing unexpected texture, dramatic silhouette against volumetric light, slow-motion reveal of something mesmerizing.
2. CAMERA LANGUAGE: Every movement tells a story — Spielberg dolly-in for intimacy, Kubrick symmetry for power, Fincher tracking shot for tension, Malick golden hour crane for transcendence. NEVER static.
3. LIGHTING AS CHARACTER: Light IS the story. Rembrandt triangle for drama, rim lighting for mystery, volumetric god rays for epic scale, practical neon for modernity, chiaroscuro for sophistication.
4. EMOTION OVER INFORMATION: The viewer must FEEL something in 5 seconds — awe, desire, curiosity, inspiration, wonder. One subject, one action, one overwhelming mood.
5. PREMIUM TEXTURE: Every surface is tangible — you can feel the brushed metal, the fabric weave, the water droplet, the skin pore. 8K IMAX quality.
6. COLOR STORY: Deliberate palette — teal/orange for cinematic, desaturated with single color pop for editorial, warm amber for luxury, cool blue for tech, rich earth tones for authenticity.

Output ONLY the visual prompt in English. Max 120 words. No titles, no explanations.

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
          negative_prompt: 'blurry, low quality, text overlay, watermark, distorted, ugly, static camera, flat lighting, overexposed, underexposed, stock footage look, generic corporate, amateur, cartoon, anime, illustration, painting, cheap graphics, lens distortion, chromatic aberration, motion sickness, jerky camera, inconsistent lighting, visible crew, boom mic, poorly composited, green screen artifacts',
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
      // Also check for PENDING_VIDEO without comfyRunId — needs local generation
      const stuckVideos = await prisma.scheduledPost.findMany({
        where: { status: 'PENDING_VIDEO', comfyRunId: null },
      });

      for (const post of stuckVideos) {
        const topicText = post.topic || post.message.substring(0, 100);
        await agentLog('VideoGenerator', `Found stuck PENDING_VIDEO post "${topicText}" — generating locally...`, { type: 'action' });
        const success = await generateVideoLocally(post.id, topicText, post.message, 'autoridade', post.imageUrl || undefined);
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
