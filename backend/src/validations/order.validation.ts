import { z } from 'zod';

export const orderCreateSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  discount_amount: z.coerce.number().min(0).optional(),
  used_points: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().optional().nullable(),
  payment: z.object({
    method: z.enum(['cash', 'card', 'transfer', 'momo', 'zalopay']).default('cash'),
    received_amount: z.coerce.number().min(0).optional(),
    reference_code: z.string().trim().optional().nullable(),
  }).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().int().min(1, 'Số lượng phải lớn hơn 0'),
    discount: z.coerce.number().min(0).optional(),
  })).min(1, 'Hóa đơn cần ít nhất một sản phẩm'),
});

export const cancelOrderSchema = z.object({
  note: z.string().trim().optional().nullable(),
  restock: z.boolean().optional(),
});
