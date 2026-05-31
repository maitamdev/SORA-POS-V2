import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

// Axios instance với base URL và interceptors
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - tự động gắn token vào header Authorization
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - xử lý lỗi 401 (token hết hạn / không hợp lệ)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;

      // Chỉ logout & redirect nếu KHÔNG phải đang ở trang login
      // và KHÔNG phải request login
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isLoginPage = currentPath === '/login';

      if (!isLoginRequest && !isLoginPage) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
