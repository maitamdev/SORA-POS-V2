import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập mã đăng nhập hoặc email'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});
