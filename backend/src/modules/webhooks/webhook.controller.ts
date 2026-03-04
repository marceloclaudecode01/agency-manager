import { Request, Response } from 'express';
import { processCompletedVideo } from '../../agents/video-generator.agent';
import { agentLog } from '../../agents/agent-logger';
import prisma from '../../config/database';

/**
 * Handle ComfyDeploy webhook callback
 * Responds 200 immediately, processes video async
 */
export async function handleComfyDeployWebhook(req: Request, res: Response) {
  // Respond immediately — don't block ComfyDeploy
  res.status(200).json({ received: true });

  try {
    const { run_id, status, outputs } = req.body || {};

    if (!run_id) {
      console.error('[Webhook] ComfyDeploy callback missing run_id');
      return;
    }

    await agentLog('Webhook', `ComfyDeploy callback: run=${run_id}, status=${status}`, { type: 'info' });

    if (status === 'success') {
      await processCompletedVideo(run_id, outputs);
    } else if (status === 'failed') {
      // Fallback to image
      const post = await prisma.scheduledPost.findFirst({ where: { comfyRunId: run_id } });
      if (post) {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { contentType: 'organic', status: 'PENDING', comfyRunId: null },
        });
        await agentLog('Webhook', `ComfyDeploy run ${run_id} failed. Post "${post.topic}" reverted to image.`, { type: 'error' });
      }
    }
    // Other statuses (queued, running) — ignore, polling handles them
  } catch (err: any) {
    console.error('[Webhook] ComfyDeploy handler error:', err.message);
  }
}
