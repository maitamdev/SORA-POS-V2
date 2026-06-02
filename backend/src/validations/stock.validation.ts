import { z } from 'zod';

export const stockImportSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, 'Số lượng nhập phải lớn hơn 0'),
  note: z.string().trim().optional().nullable(),
});

export const stockAdjustSchema = z.object({
  product_id: z.string().uuid(),
  new_stock: z.coerce.number().int().min(0, 'Tồn kho mới không được âm'),
  note: z.string().trim().optional().nullable(),
});

export const resolveAlertSchema = z.object({
  status: z.enum(['resolved']).default('resolved'),
});
