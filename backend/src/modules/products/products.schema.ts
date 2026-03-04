import { z } from 'zod';

export const createProductSchema = z.object({
  productUrl: z.string().url('Invalid product URL'),
  imageUrl: z.string().url('Invalid image URL'),
  title: z.string().max(200).optional(),
});

export const updateProductSchema = z.object({
  replyTemplate: z.string().max(2000).optional(),
  autoReply: z.boolean().optional(),
  status: z.enum(['SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
});

export const analyzeLinkSchema = z.object({
  url: z.string().url('Invalid URL'),
});
