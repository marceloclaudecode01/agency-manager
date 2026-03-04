/**
 * Video Generation Service — Dual Provider with Fallback
 *
 * Provider 1: Comfy Cloud (cloud.comfy.org) — workflow JSON inline, no setup needed
 * Provider 2: ComfyDeploy (comfydeploy.com) — requires deployment_id from dashboard
 *
 * Env vars:
 *   COMFY_CLOUD_API_KEY       → Provider 1 (primary)
 *   COMFYDEPLOY_API_KEY       → Provider 2 (fallback)
 *   COMFYDEPLOY_DEPLOYMENT_ID → Provider 2 (fallback)
 */

// ─── Types ───

interface VideoJobInput {
  prompt: string;
  negative_prompt?: string;
}

interface VideoJobResult {
  provider: 'comfy-cloud' | 'comfydeploy';
  job_id: string;
}

interface VideoJobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  outputs?: any;
  provider: 'comfy-cloud' | 'comfydeploy';
}

// ─── CogVideoX Text-to-Video Workflow (ComfyUI API format) ───
// Minimal CogVideoX-5B pipeline: TextEncode → Sampler → Decode → SaveVideo
// This runs on Comfy Cloud's GPU infrastructure with auto model download

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

// ─── Provider 1: Comfy Cloud ───

const COMFY_CLOUD_BASE = 'https://cloud.comfy.org';

function getComfyCloudKey(): string | null {
  return process.env.COMFY_CLOUD_API_KEY || null;
}

function isComfyCloudConfigured(): boolean {
  return !!getComfyCloudKey();
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

    // Find video output in node outputs (node "5" = VHS_VideoCombine)
    for (const nodeId of Object.keys(history.outputs)) {
      const nodeOutput = history.outputs[nodeId];

      // Check for video files
      const videos = nodeOutput?.videos || nodeOutput?.gifs || [];
      for (const file of videos) {
        if (file.filename) {
          const params = new URLSearchParams({
            filename: file.filename,
            subfolder: file.subfolder || '',
            type: 'output',
          });
          // Get signed URL via redirect
          const viewRes = await fetch(`${COMFY_CLOUD_BASE}/api/view?${params}`, {
            headers: { 'X-API-Key': apiKey },
            redirect: 'manual',
          });
          const signedUrl = viewRes.headers.get('location');
          if (signedUrl) return signedUrl;
        }
      }

      // Check for images (fallback if video saved as image sequence)
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

// ─── Provider 2: ComfyDeploy (original) ───

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
  return isComfyCloudConfigured() || isComfyDeployConfigured();
}

export function getActiveProvider(): 'comfy-cloud' | 'comfydeploy' | null {
  if (isComfyCloudConfigured()) return 'comfy-cloud';
  if (isComfyDeployConfigured()) return 'comfydeploy';
  return null;
}

export async function queueVideoGeneration(inputs: VideoJobInput): Promise<VideoJobResult> {
  const { prompt, negative_prompt = '' } = inputs;

  // Try Comfy Cloud first
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

  throw new Error('No video provider configured (need COMFY_CLOUD_API_KEY or COMFYDEPLOY_API_KEY + DEPLOYMENT_ID)');
}

export async function getRunStatus(jobId: string): Promise<VideoJobStatus> {
  // Try Comfy Cloud first
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
