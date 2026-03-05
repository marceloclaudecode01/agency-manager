/**
 * Video Generation Service — Multi-Provider with Fallback
 *
 * Provider priority:
 *   1. HuggingFace Inference API (FREE with HF token — LTX-Video)
 *   2. Comfy Cloud (cloud.comfy.org)
 *   3. ComfyDeploy (comfydeploy.com)
 *
 * Env vars:
 *   HF_TOKEN                  → Provider 1 (primary, FREE)
 *   COMFY_CLOUD_API_KEY       → Provider 2
 *   COMFYDEPLOY_API_KEY       → Provider 3
 *   COMFYDEPLOY_DEPLOYMENT_ID → Provider 3
 */

import axios from 'axios';

// ─── Types ───

interface VideoJobInput {
  prompt: string;
  negative_prompt?: string;
}

interface VideoJobResult {
  provider: 'huggingface' | 'comfy-cloud' | 'comfydeploy';
  job_id: string;
  videoUrl?: string; // HuggingFace returns video directly (synchronous)
}

interface VideoJobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  outputs?: any;
  provider: 'huggingface' | 'comfy-cloud' | 'comfydeploy';
}

// ─── Provider 1: HuggingFace Inference API (FREE) ───
// Uses LTX-Video — fast text-to-video, synchronous response
// Returns video bytes directly — no polling needed

const HF_MODEL = 'Lightricks/LTX-Video-0.9.8-13B-distilled';
const HF_INFERENCE_URL = `https://router.huggingface.co/fal-ai/fal-ai/ltx-video/image-to-video`;
const HF_TEXT_TO_VIDEO_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

function getHFToken(): string | null {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || null;
}

function isHuggingFaceConfigured(): boolean {
  return !!getHFToken();
}

async function submitHuggingFace(prompt: string, negativePrompt: string): Promise<{ videoBuffer: Buffer; jobId: string }> {
  const token = getHFToken()!;

  const res = await axios.post(
    HF_TEXT_TO_VIDEO_URL,
    {
      inputs: prompt,
      parameters: {
        num_frames: 49,
        num_inference_steps: 20,
        guidance_scale: 7.5,
        negative_prompt: [negativePrompt],
        seed: Math.floor(Math.random() * 2147483647),
      },
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'video/mp4',
      },
      responseType: 'arraybuffer',
      timeout: 300000, // 5 minutes — video generation takes time
    }
  );

  if (res.status !== 200 || !res.data || res.data.byteLength < 5000) {
    throw new Error(`HuggingFace returned invalid response: status=${res.status}, size=${res.data?.byteLength || 0}`);
  }

  const jobId = `hf_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  return { videoBuffer: Buffer.from(res.data), jobId };
}

// ─── Provider 2: Comfy Cloud ───

const COMFY_CLOUD_BASE = 'https://cloud.comfy.org';

function getComfyCloudKey(): string | null {
  return process.env.COMFY_CLOUD_API_KEY || null;
}

function isComfyCloudConfigured(): boolean {
  return !!getComfyCloudKey();
}

function buildCogVideoWorkflow(prompt: string, negativePrompt: string): Record<string, any> {
  return {
    "1": {
      "class_type": "DownloadAndLoadCogVideoModel",
      "inputs": {
        "model": "THUDM/CogVideoX-5b",
        "precision": "bf16",
        "quantization": "disabled",
        "enable_sequential_cpu_offload": true
      }
    },
    "2": {
      "class_type": "CogVideoTextEncode",
      "inputs": {
        "prompt": prompt,
        "negative_prompt": negativePrompt,
        "force_offload": true,
        "pipeline": ["1", 0]
      }
    },
    "3": {
      "class_type": "CogVideoSampler",
      "inputs": {
        "height": 480,
        "width": 720,
        "num_frames": 49,
        "steps": 30,
        "cfg": 6.0,
        "seed": Math.floor(Math.random() * 2147483647),
        "scheduler": "CogVideoXDDIM",
        "denoise_strength": 1.0,
        "pipeline": ["1", 0],
        "positive": ["2", 0],
        "negative": ["2", 1]
      }
    },
    "4": {
      "class_type": "CogVideoDecode",
      "inputs": {
        "enable_vae_tiling": true,
        "pipeline": ["1", 0],
        "samples": ["3", 0]
      }
    },
    "5": {
      "class_type": "VHS_VideoCombine",
      "inputs": {
        "frame_rate": 8,
        "loop_count": 0,
        "filename_prefix": "cogvideo",
        "format": "video/h264-mp4",
        "save_output": true,
        "images": ["4", 0]
      }
    }
  };
}

async function submitComfyCloud(prompt: string, negativePrompt: string): Promise<string> {
  const apiKey = getComfyCloudKey()!;
  const workflow = buildCogVideoWorkflow(prompt, negativePrompt);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${COMFY_CLOUD_BASE}/api/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ prompt: workflow }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Comfy Cloud submit failed (${res.status}): ${body}`);
    }

    const data = await res.json() as { prompt_id: string };
    return data.prompt_id;
  } finally {
    clearTimeout(timeout);
  }
}

async function pollComfyCloud(jobId: string): Promise<VideoJobStatus> {
  const apiKey = getComfyCloudKey()!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${COMFY_CLOUD_BASE}/api/job/${jobId}/status`, {
      headers: { 'X-API-Key': apiKey },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Comfy Cloud status check failed (${res.status})`);

    const data = await res.json() as { status: string };

    const statusMap: Record<string, VideoJobStatus['status']> = {
      'pending': 'pending',
      'in_progress': 'running',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
    };

    return {
      status: statusMap[data.status] || 'pending',
      provider: 'comfy-cloud',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getComfyCloudOutputs(jobId: string): Promise<string | null> {
  const apiKey = getComfyCloudKey()!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${COMFY_CLOUD_BASE}/api/history_v2/${jobId}`, {
      headers: { 'X-API-Key': apiKey },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const history = await res.json() as { outputs?: Record<string, any> };
    if (!history.outputs) return null;

    for (const nodeId of Object.keys(history.outputs)) {
      const nodeOutput = history.outputs[nodeId];

      const videos = nodeOutput?.videos || nodeOutput?.gifs || [];
      for (const file of videos) {
        if (file.filename) {
          const params = new URLSearchParams({
            filename: file.filename,
            subfolder: file.subfolder || '',
            type: 'output',
          });
          const viewRes = await fetch(`${COMFY_CLOUD_BASE}/api/view?${params}`, {
            headers: { 'X-API-Key': apiKey },
            redirect: 'manual',
          });
          const signedUrl = viewRes.headers.get('location');
          if (signedUrl) return signedUrl;
        }
      }

      const images = nodeOutput?.images || [];
      for (const file of images) {
        if (file.filename && (file.filename.includes('.mp4') || file.filename.includes('.webm'))) {
          const params = new URLSearchParams({
            filename: file.filename,
            subfolder: file.subfolder || '',
            type: 'output',
          });
          const viewRes = await fetch(`${COMFY_CLOUD_BASE}/api/view?${params}`, {
            headers: { 'X-API-Key': apiKey },
            redirect: 'manual',
          });
          const signedUrl = viewRes.headers.get('location');
          if (signedUrl) return signedUrl;
        }
      }
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Provider 3: ComfyDeploy ───

const COMFYDEPLOY_API_BASE = 'https://www.comfydeploy.com/api';
const WEBHOOK_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/webhooks/comfydeploy`
  : 'https://agency-manager-production.up.railway.app/api/webhooks/comfydeploy';

function getComfyDeployKey(): string | null {
  return process.env.COMFYDEPLOY_API_KEY || null;
}

function getDeploymentId(): string | null {
  return process.env.COMFYDEPLOY_DEPLOYMENT_ID || null;
}

function isComfyDeployConfigured(): boolean {
  return !!(getComfyDeployKey() && getDeploymentId());
}

async function submitComfyDeploy(prompt: string, negativePrompt: string): Promise<string> {
  const apiKey = getComfyDeployKey()!;
  const deploymentId = getDeploymentId()!;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${COMFYDEPLOY_API_BASE}/run/deployment/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        deployment_id: deploymentId,
        inputs: { prompt, negative_prompt: negativePrompt },
        webhook: WEBHOOK_URL,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ComfyDeploy queue failed (${res.status}): ${body}`);
    }

    const data = await res.json() as { run_id: string };
    return data.run_id;
  } finally {
    clearTimeout(timeout);
  }
}

async function pollComfyDeploy(runId: string): Promise<VideoJobStatus> {
  const apiKey = getComfyDeployKey()!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${COMFYDEPLOY_API_BASE}/run/${runId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`ComfyDeploy status check failed (${res.status})`);

    const data = await res.json() as { status: string; outputs?: any };

    const statusMap: Record<string, VideoJobStatus['status']> = {
      'queued': 'pending',
      'running': 'running',
      'success': 'completed',
      'failed': 'failed',
    };

    return {
      status: statusMap[data.status] || 'pending',
      outputs: data.outputs,
      provider: 'comfydeploy',
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API (unified, provider-agnostic) ───

export function isConfigured(): boolean {
  return isHuggingFaceConfigured() || isComfyCloudConfigured() || isComfyDeployConfigured();
}

export function getActiveProvider(): 'huggingface' | 'comfy-cloud' | 'comfydeploy' | null {
  if (isHuggingFaceConfigured()) return 'huggingface';
  if (isComfyCloudConfigured()) return 'comfy-cloud';
  if (isComfyDeployConfigured()) return 'comfydeploy';
  return null;
}

export async function queueVideoGeneration(inputs: VideoJobInput): Promise<VideoJobResult> {
  const { prompt, negative_prompt = '' } = inputs;

  // Try HuggingFace first (FREE, synchronous — returns video directly)
  if (isHuggingFaceConfigured()) {
    try {
      const { videoBuffer, jobId } = await submitHuggingFace(prompt, negative_prompt);
      console.log(`[VideoService] ✓ HuggingFace video generated: ${jobId} (${videoBuffer.byteLength} bytes)`);

      // Upload to Cloudinary immediately (synchronous flow)
      let videoUrl: string;
      try {
        const { uploadVideoFromBuffer } = await import('../config/cloudinary');
        const uploaded = await uploadVideoFromBuffer(videoBuffer, 'agency-videos');
        videoUrl = uploaded.url;
        console.log(`[VideoService] ✓ Video uploaded to Cloudinary: ${videoUrl}`);
      } catch (uploadErr: any) {
        // Fallback: save as base64 data URI (temporary)
        console.error(`[VideoService] Cloudinary upload failed: ${uploadErr.message}`);
        throw new Error(`Video generated but upload failed: ${uploadErr.message}`);
      }

      return { provider: 'huggingface', job_id: jobId, videoUrl };
    } catch (err: any) {
      console.error(`[VideoService] HuggingFace failed: ${err.message} — trying next provider...`);
    }
  }

  // Try Comfy Cloud
  if (isComfyCloudConfigured()) {
    try {
      const jobId = await submitComfyCloud(prompt, negative_prompt);
      console.log(`[VideoService] ✓ Comfy Cloud job submitted: ${jobId}`);
      return { provider: 'comfy-cloud', job_id: jobId };
    } catch (err: any) {
      console.error(`[VideoService] Comfy Cloud failed: ${err.message} — trying ComfyDeploy...`);
    }
  }

  // Fallback to ComfyDeploy
  if (isComfyDeployConfigured()) {
    const runId = await submitComfyDeploy(prompt, negative_prompt);
    console.log(`[VideoService] ✓ ComfyDeploy job submitted: ${runId}`);
    return { provider: 'comfydeploy', job_id: runId };
  }

  throw new Error('No video provider configured (need HF_TOKEN, COMFY_CLOUD_API_KEY, or COMFYDEPLOY_API_KEY + DEPLOYMENT_ID)');
}

export async function getRunStatus(jobId: string): Promise<VideoJobStatus> {
  // HuggingFace jobs are synchronous — if we're polling, it means it completed already
  if (jobId.startsWith('hf_')) {
    return { status: 'completed', provider: 'huggingface' };
  }

  // Try Comfy Cloud
  if (isComfyCloudConfigured()) {
    try {
      return await pollComfyCloud(jobId);
    } catch {
      // Fall through to ComfyDeploy
    }
  }

  if (isComfyDeployConfigured()) {
    return await pollComfyDeploy(jobId);
  }

  throw new Error('No video provider configured');
}

export async function getVideoOutputUrl(jobId: string, provider: string, outputs?: any): Promise<string | null> {
  // HuggingFace: videoUrl is already set during queueVideoGeneration
  if (provider === 'huggingface') {
    return null; // Already handled synchronously
  }

  // Comfy Cloud: get video URL from history
  if (provider === 'comfy-cloud') {
    return await getComfyCloudOutputs(jobId);
  }

  // ComfyDeploy: extract URL from outputs
  if (outputs) {
    if (Array.isArray(outputs)) {
      for (const output of outputs) {
        const images = output?.data?.images || output?.images;
        if (Array.isArray(images)) {
          for (const img of images) {
            if (img.url) return img.url;
          }
        }
        if (output?.url) return output.url;
      }
    } else if (outputs?.url) {
      return outputs.url;
    }
  }

  return null;
}
