import { z } from 'zod';

const optionalText = z.string().trim().optional().nullable();

export const staffCreateSchema = z.object({
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
  full_name: z.string().trim().min(1, 'Ten nhan vien la bat buoc'),
  phone: optionalText,
  role: z.enum(['cashier', 'manager', 'admin']).optional(),
  is_active: z.boolean().optional(),
});

export const staffUpdateSchema = z.object({
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu').optional().or(z.literal('')),
  full_name: z.string().trim().min(1, 'Ten nhan vien la bat buoc').optional(),
  phone: optionalText,
  role: z.enum(['cashier', 'manager', 'admin']).optional(),
  is_active: z.boolean().optional(),
});
