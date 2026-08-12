import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập mã đăng nhập hoặc email'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

const newPassword = z
  .string()
  .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
  .max(128, 'Mật khẩu mới không được vượt quá 128 ký tự');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Mã khôi phục không hợp lệ'),
  newPassword,
});
