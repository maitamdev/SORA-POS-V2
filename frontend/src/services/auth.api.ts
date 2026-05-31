import api from './api';
import { LoginRequest, LoginResponse, User, ApiResponse } from '../types/user.type';

export const authAPI = {
  /** POST /api/auth/login - Đăng nhập */
  login: (data: LoginRequest) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', data),

  /** POST /api/auth/logout - Đăng xuất */
  logout: () =>
    api.post<ApiResponse<null>>('/auth/logout'),

  /** GET /api/auth/me - Lấy thông tin user hiện tại (verify token) */
  getMe: () =>
    api.get<ApiResponse<{ user: User }>>('/auth/me'),
};
