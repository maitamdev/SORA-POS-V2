import { z } from 'zod';

export const promotionCreateSchema = z.object({
  name: z.string().min(1, 'Tên khuyến mãi không được để trống').max(255),
  code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),

  // 7 promotion types
  discount_type: z.enum([
    'percent', 'fixed_amount', 'buy_x_get_y', 'fixed_price',
    'nth_item_discount', 'happy_hour', 'bundle',
  ]),

  discount_value: z.number().min(0).default(0),
  max_discount: z.number().positive().optional().nullable(),
  min_order_amount: z.number().min(0).default(0),

  // BOGO config
  buy_quantity: z.number().int().min(0).default(0),
  get_quantity: z.number().int().min(0).default(0),
  get_product_ids: z.array(z.string().uuid()).default([]),

  // Combo config
  combo_quantity: z.number().int().min(0).default(0),

  // Nth item discount
  nth_item: z.number().int().min(2).default(2),

  // Happy hour
  happy_hour_start: z.string().optional().nullable(),
  happy_hour_end: z.string().optional().nullable(),

  // Bundle
  bundle_product_ids: z.array(z.string().uuid()).default([]),

  // Scope
  apply_to: z.enum(['all', 'category', 'product']).default('all'),
  apply_to_ids: z.array(z.string().uuid()).default([]),

  // Validity
  start_date: z.string().optional(),
  end_date: z.string().optional().nullable(),
  usage_limit: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.discount_type === 'percent' || data.discount_type === 'happy_hour') {
    if (data.discount_value <= 0 || data.discount_value > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phần trăm giảm phải từ 1-100%', path: ['discount_value'] });
    }
  }
  if (data.discount_type === 'fixed_amount') {
    if (data.discount_value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Số tiền giảm phải lớn hơn 0', path: ['discount_value'] });
    }
  }
  if (data.discount_type === 'buy_x_get_y') {
    if (!data.buy_quantity || data.buy_quantity < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Số lượng cần mua phải ≥ 1', path: ['buy_quantity'] });
    }
    if (!data.get_quantity || data.get_quantity < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Số lượng tặng phải ≥ 1', path: ['get_quantity'] });
    }
  }
  if (data.discount_type === 'fixed_price') {
    if (data.discount_value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Giá combo phải lớn hơn 0', path: ['discount_value'] });
    }
    if (!data.combo_quantity || data.combo_quantity < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Combo phải có ít nhất 2 sản phẩm', path: ['combo_quantity'] });
    }
  }
  if (data.discount_type === 'nth_item_discount') {
    if (data.discount_value <= 0 || data.discount_value > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phần trăm giảm phải từ 1-100%', path: ['discount_value'] });
    }
    if (!data.nth_item || data.nth_item < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SP thứ mấy phải ≥ 2', path: ['nth_item'] });
    }
  }
  if (data.discount_type === 'happy_hour') {
    if (!data.happy_hour_start || !data.happy_hour_end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phải chọn khung giờ bắt đầu và kết thúc', path: ['happy_hour_start'] });
    }
  }
  if (data.discount_type === 'bundle') {
    if (data.discount_value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Giá combo phải lớn hơn 0', path: ['discount_value'] });
    }
    if (!data.bundle_product_ids || data.bundle_product_ids.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bundle phải có ít nhất 2 sản phẩm', path: ['bundle_product_ids'] });
    }
  }
});

export const promotionUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  discount_type: z.enum([
    'percent', 'fixed_amount', 'buy_x_get_y', 'fixed_price',
    'nth_item_discount', 'happy_hour', 'bundle',
  ]).optional(),
  discount_value: z.number().min(0).optional(),
  max_discount: z.number().positive().optional().nullable(),
  min_order_amount: z.number().min(0).optional(),
  buy_quantity: z.number().int().min(0).optional(),
  get_quantity: z.number().int().min(0).optional(),
  get_product_ids: z.array(z.string().uuid()).optional(),
  combo_quantity: z.number().int().min(0).optional(),
  nth_item: z.number().int().min(2).optional(),
  happy_hour_start: z.string().optional().nullable(),
  happy_hour_end: z.string().optional().nullable(),
  bundle_product_ids: z.array(z.string().uuid()).optional(),
  apply_to: z.enum(['all', 'category', 'product']).optional(),
  apply_to_ids: z.array(z.string().uuid()).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional().nullable(),
  usage_limit: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const promotionValidateSchema = z.object({
  code: z.string().min(1, 'Mã khuyến mãi không được để trống'),
  order_total: z.number().min(0),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        category_id: z.string().uuid().optional().nullable(),
        quantity: z.number().int().positive(),
        unit_price: z.number().min(0),
      })
    )
    .optional()
    .default([]),
});
