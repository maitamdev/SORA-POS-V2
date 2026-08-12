import api from './api';
import { LoginRequest, LoginResponse, User, ApiResponse } from '../types/user.type';

export const authAPI = {
  /** POST /api/auth/login - Đăng nhập */
  login: (data: LoginRequest) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', data),

  /** POST /api/auth/forgot-password - Gửi email khôi phục */
  forgotPassword: (data: { email: string }) =>
    api.post<ApiResponse<null>>('/auth/forgot-password', data),

  /** POST /api/auth/reset-password - Đặt lại mật khẩu từ liên kết email */
  resetPassword: (data: { token: string; newPassword: string }) =>
    api.post<ApiResponse<null>>('/auth/reset-password', data),

  /** POST /api/auth/logout - Đăng xuất */
  logout: () =>
    api.post<ApiResponse<null>>('/auth/logout'),

  /** POST /api/auth/change-password - Đổi mật khẩu khi đã đăng nhập */
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<ApiResponse<null>>('/auth/change-password', data),

  /** GET /api/auth/me - Lấy thông tin user hiện tại (verify token) */
  getMe: () =>
    api.get<ApiResponse<{ user: User }>>('/auth/me'),
};
