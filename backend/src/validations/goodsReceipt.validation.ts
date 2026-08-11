import { z } from 'zod';

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Hạn sử dụng phải có định dạng YYYY-MM-DD');

const receiptItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().finite().int().positive(),
  unit_price: z.coerce.number().finite().min(0),
  expiry_date: dateSchema,
  batch_number: z.string().trim().min(1).max(100),
});

export const goodsReceiptCreateSchema = z.object({
  supplier_id: z.string().uuid(),
  note: z.string().trim().max(500).optional().nullable(),
  paid_amount: z.coerce.number().finite().min(0).default(0),
  // A single receipt with an unbounded number of lines can exhaust the
  // fallback path and create a very large transaction payload.
  items: z.array(receiptItemSchema).min(1).max(500),
});

export const goodsReceiptPaymentSchema = z.object({
  pay_amount: z.coerce.number().finite().positive(),
});
