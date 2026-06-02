import { z } from 'zod';

export const aiRecommendSchema = z.object({
  target_days: z.coerce.number().int().min(1).max(90).optional(),
  product_id: z.string().uuid().optional(),
});

export const aiStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
