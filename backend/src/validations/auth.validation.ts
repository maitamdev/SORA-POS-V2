import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Vui long nhap ma dang nhap hoac email'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
});
