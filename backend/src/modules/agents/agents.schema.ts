import { z } from 'zod';

export const generatePostSchema = z.object({
  topic: z.string().min(1).max(500).optional(),
  extraContext: z.string().max(2000).optional(),
});

export const createScheduledPostSchema = z.object({
  topic: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
  imageUrl: z.string().url().max(2000).optional(),
  mediaUrl: z.string().url().max(2000).optional(),
  scheduledFor: z.string().datetime(),
});

export const approvePostSchema = z.object({
  scheduledFor: z.string().datetime(),
});

export const safeModeSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const toggleAgentSchema = z.object({
  paused: z.boolean(),
});

export const overridePostSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export const overrideStrategySchema = z.object({
  maxPostsPerDay: z.number().int().min(1).max(50).optional(),
  contentMix: z.record(z.number()).optional(),
  bestPostingHours: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(24).optional(),
  adjustmentReason: z.string().max(500).optional(),
});

export const brandConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  contentMix: z.record(z.any()).optional(),
  postsPerDay: z.number().int().min(0).max(50).optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const replicatePostSchema = z.object({
  postId: z.string().min(1),
  formats: z.array(z.string()).optional(),
});

export const aggressiveModeSchema = z.object({
  enabled: z.boolean(),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  function: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cronExpression: z.string().max(100).optional(),
  autonomyLevel: z.number().int().min(1).max(10).optional(),
  status: z.enum(['active', 'paused', 'error']).optional(),
});

export const updateAgentStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'error']),
});

export const postFromLinkSchema = z.object({
  url: z.string().url().max(2000),
  scheduledFor: z.string().datetime().optional(),
  mediaUrl: z.string().url().max(2000).optional(),
});

export const productOrchestratorSchema = z.object({
  query: z.string().min(1).max(500).optional(),
});
