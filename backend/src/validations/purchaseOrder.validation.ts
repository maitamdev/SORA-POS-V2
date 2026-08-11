import { z } from 'zod';

const dateOrDateTime = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), 'Ngày dự kiến không hợp lệ');

const purchaseOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().finite().int().positive(),
  unit_cost: z.coerce.number().finite().min(0),
});

const receiveItemSchema = z.object({
  purchase_order_item_id: z.string().uuid(),
  quantity: z.coerce.number().finite().int().positive(),
  unit_price: z.coerce.number().finite().min(0).optional(),
  expiry_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hạn sử dụng phải có định dạng YYYY-MM-DD'),
  batch_number: z.string().trim().min(1).max(100),
});

const uniqueLineIds = <T extends { product_id?: string; purchase_order_item_id?: string }>(items: T[], ctx: z.RefinementCtx) => {
  const ids = items.map((item) => item.product_id || item.purchase_order_item_id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Không được lặp sản phẩm/dòng hàng trong cùng một thao tác', path: ['items'] });
  }
};

export const purchaseOrderCreateSchema = z
  .object({
    supplier_id: z.string().uuid(),
    expected_at: dateOrDateTime.optional().nullable(),
    note: z.string().trim().max(2000).optional().nullable(),
    items: z.array(purchaseOrderItemSchema).min(1).max(500),
  })
  .superRefine((value, ctx) => uniqueLineIds(value.items, ctx));
export const purchaseOrderStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'ordered', 'in_transit', 'cancelled']),
});

export const purchaseOrderReceiveSchema = z
  .object({
    note: z.string().trim().max(2000).optional().nullable(),
    paid_amount: z.coerce.number().finite().min(0).default(0),
    expiry_date: z.string().trim().optional(),
    receipt_number: z.string().trim().min(1).max(50).optional(),
    items: z.array(receiveItemSchema).min(1).max(500),
  })
  .superRefine((value, ctx) => uniqueLineIds(value.items, ctx));
