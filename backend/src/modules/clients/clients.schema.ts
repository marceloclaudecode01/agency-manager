import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LEAD']).optional(),
  notes: z.string().optional().nullable(),
  facebookPageId: z.string().optional().nullable(),
  facebookAccessToken: z.string().optional().nullable(),
  facebookPageName: z.string().optional().nullable(),
  niche: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();
