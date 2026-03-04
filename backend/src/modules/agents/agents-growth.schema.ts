import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(50).optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']).optional(),
  score: z.number().int().min(0).max(100).optional(),
  source: z.string().max(100).optional(),
  sourceId: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(50).optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']).optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const moveLeadStageSchema = z.object({
  stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']),
});

export const addInteractionSchema = z.object({
  type: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  direction: z.enum(['inbound', 'outbound']).optional(),
});

export const checkComplianceSchema = z.object({
  message: z.string().min(1).max(5000),
  platform: z.string().max(50).optional(),
});
