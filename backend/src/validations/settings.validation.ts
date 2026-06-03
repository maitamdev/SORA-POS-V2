import { z } from 'zod';

export const operationSettingsSchema = z.object({
  storeName: z.string().trim().min(1, 'Tên cửa hàng là bắt buộc'),
  branchName: z.string().trim().optional().default(''),
  taxCode: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  hotline: z.string().trim().optional().default(''),
  businessHours: z.string().trim().optional().default(''),
  currency: z.string().trim().min(1).default('VND'),
  locale: z.string().trim().min(1).default('vi-VN'),
  defaultPaymentMethod: z.enum(['cash', 'transfer', 'card']).default('cash'),
  allowDiscount: z.boolean().default(true),
  maxDiscountPercent: z.coerce.number().min(0).max(100).default(20),
  requireCustomerPhone: z.boolean().default(false),
  autoPrintReceipt: z.boolean().default(true),
  receiptPaperSize: z.enum(['k80', 'a5']).default('k80'),
  receiptCopies: z.coerce.number().int().min(1).max(5).default(1),
  receiptFooter: z.string().trim().optional().default(''),
  lowStockWarning: z.boolean().default(true),
  defaultMinStockLevel: z.coerce.number().int().min(0).max(9999).default(10),
  allowSellOutOfStock: z.boolean().default(false),
  barcodeAutoAdd: z.boolean().default(true),
  productPageSize: z.coerce.number().int().min(8).max(100).default(20),
  confirmBeforeCheckout: z.boolean().default(false),
  sessionLockMinutes: z.coerce.number().int().min(5).max(240).default(30),
  compactMode: z.boolean().default(false),
});

export type OperationSettings = z.infer<typeof operationSettingsSchema>;
