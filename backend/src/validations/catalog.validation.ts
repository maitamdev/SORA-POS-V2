import { z } from 'zod';

const optionalText = z.string().trim().optional().nullable();
const optionalUuid = z.string().uuid().optional().nullable();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Tên danh mục là bắt buộc'),
  description: optionalText,
  image_url: optionalText,
  is_active: z.boolean().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1, 'Tên nhà cung cấp là bắt buộc'),
  contact_person: optionalText,
  email: z.string().email('Email không hợp lệ').optional().nullable().or(z.literal('')),
  phone: optionalText,
  address: optionalText,
  tax_code: optionalText,
  is_active: z.boolean().optional(),
});

export const supplierUpdateSchema = supplierCreateSchema.partial();

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1, 'SKU là bắt buộc'),
  barcode: optionalText,
  name: z.string().trim().min(1, 'Tên sản phẩm là bắt buộc'),
  description: optionalText,
  category_id: optionalUuid,
  supplier_id: optionalUuid,
  cost_price: z.coerce.number().min(0, 'Giá nhập không được âm'),
  sell_price: z.coerce.number().min(0, 'Giá bán không được âm'),
  stock_quantity: z.coerce.number().int().min(0, 'Tồn kho không được âm').optional(),
  min_stock_level: z.coerce.number().int().min(0, 'Ngưỡng tồn kho không được âm').optional(),
  unit: z.string().trim().min(1).optional(),
  image_url: optionalText,
  is_active: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productBulkCreateSchema = z.object({
  products: z.array(productCreateSchema),
});

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Tên khách hàng là bắt buộc'),
  email: z.string().email('Email không hợp lệ').optional().nullable().or(z.literal('')),
  phone: optionalText,
  address: optionalText,
  points: z.coerce.number().int().min(0).optional(),
  total_spent: z.coerce.number().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();
