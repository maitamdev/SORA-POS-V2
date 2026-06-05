import { z } from 'zod';

export const openShiftSchema = z.object({
  employee_id: z.string().uuid(),
  shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shift_name: z.string().trim().max(80).optional().nullable(),
});

export const checkInShiftSchema = z.object({
  opening_cash: z.coerce.number().min(0, 'Tiền đầu ca không hợp lệ'),
});

export const closeShiftSchema = z.object({
  closing_cash: z.coerce.number().min(0, 'Tiền chốt ca không hợp lệ'),
  note: z.string().trim().max(500).optional().nullable(),
});
