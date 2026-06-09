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
    const { token, user } = useAuthStore.getState();
    const isDemo = user?.email === 'demo@sora-pos.com';

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Chặn request thay đổi dữ liệu nếu là tài khoản Demo
    if (isDemo && config.method && !['get', 'options'].includes(config.method.toLowerCase())) {
      if (!config.url?.includes('/auth/login')) {
        const CancelToken = axios.CancelToken;
        const source = CancelToken.source();
        config.cancelToken = source.token;
        source.cancel('DEMO_MODE_INTERCEPT');
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - xử lý lỗi 401 (token hết hạn / không hợp lệ) và Mock Demo
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Xử lý chặn Demo Mode
    if (axios.isCancel(error) && error.message === 'DEMO_MODE_INTERCEPT') {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.success('Thao tác thành công (Chế độ Demo - Dữ liệu không lưu)', {
          icon: '🎮',
          duration: 3000,
        });
      });
      // Mock a successful response
      return Promise.resolve({
        data: { success: true, message: 'Mocked in Demo Mode', data: { id: `demo-${Date.now()}` } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config,
      });
    }

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
