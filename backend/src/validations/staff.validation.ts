import { z } from 'zod';

const optionalText = z.string().trim().optional().nullable();

export const staffCreateSchema = z.object({
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  full_name: z.string().trim().min(1, 'Tên nhân viên là bắt buộc'),
  phone: optionalText,
  role: z.enum(['cashier', 'manager', 'admin']).optional(),
  is_active: z.boolean().optional(),
});

export const staffUpdateSchema = z.object({
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().or(z.literal('')),
  full_name: z.string().trim().min(1, 'Tên nhân viên là bắt buộc').optional(),
  phone: optionalText,
  role: z.enum(['cashier', 'manager', 'admin']).optional(),
  is_active: z.boolean().optional(),
});
