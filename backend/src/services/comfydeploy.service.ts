/**
 * ComfyDeploy Service — API client for text-to-video generation
 * Handles queue, poll, and config check for ComfyDeploy workflows
 */

const COMFYDEPLOY_API_BASE = 'https://www.comfydeploy.com/api';
const WEBHOOK_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/webhooks/comfydeploy`
  : 'https://agency-manager-production.up.railway.app/api/webhooks/comfydeploy';

interface QueueInputs {
  prompt: string;
  negative_prompt?: string;
}

interface QueueResult {
  run_id: string;
}

interface RunStatus {
  status: 'queued' | 'running' | 'success' | 'failed';
  outputs?: Array<{ data: { images?: Array<{ url: string; type: string }> } }>;
  run_id: string;
}

function getApiKey(): string | null {
  return process.env.COMFYDEPLOY_API_KEY || null;
}

function getDeploymentId(): string | null {
  return process.env.COMFYDEPLOY_DEPLOYMENT_ID || null;
}

export function isConfigured(): boolean {
  return !!(getApiKey() && getDeploymentId());
}

export async function queueVideoGeneration(inputs: QueueInputs): Promise<QueueResult> {
  const apiKey = getApiKey();
  const deploymentId = getDeploymentId();
  if (!apiKey || !deploymentId) {
    throw new Error('ComfyDeploy not configured: missing API_KEY or DEPLOYMENT_ID');
  }

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
        inputs,
        webhook: WEBHOOK_URL,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ComfyDeploy queue failed (${res.status}): ${body}`);
    }

    const data = await res.json() as QueueResult;
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRunStatus(runId: string): Promise<RunStatus> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('ComfyDeploy API key not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${COMFYDEPLOY_API_BASE}/run/${runId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`ComfyDeploy status check failed (${res.status})`);
    }

    return await res.json() as RunStatus;
  } finally {
    clearTimeout(timeout);
  }
}
