import { z } from 'zod';

export const stockImportSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, 'Số lượng nhập phải lớn hơn 0'),
  batch_number: z.string().trim().min(1, 'Số lô không được để trống').max(100, 'Số lô tối đa 100 ký tự'),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hạn sử dụng không hợp lệ'),
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
