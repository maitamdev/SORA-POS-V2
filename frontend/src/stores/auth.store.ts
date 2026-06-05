import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '../types/user.type';
import { authAPI } from '../services/auth.api';

const AUTH_SESSION_TTL_MS = 10 * 60 * 60 * 1000;

interface AuthState {
  user: User | null;
  token: string | null;
  loginAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loginAt: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, token) =>
        set({
          user,
          token,
          loginAt: Date.now(),
          isAuthenticated: true,
          isLoading: false,
        }),

      /**
       * Đăng nhập - gọi API login rồi set state
       */
      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authAPI.login({ email, password });
          const { user, token } = response.data.data;
          set({
            user,
            token,
            loginAt: Date.now(),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      /**
       * Đăng xuất - gọi API logout (optional) rồi clear state
       */
      logout: () => {
        // Fire-and-forget logout API call
        const token = get().token;
        if (token) {
          authAPI.logout().catch(() => {
            // Ignore errors - logout API is optional
          });
        }
        set({
          user: null,
          token: null,
          loginAt: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      /**
       * Kiểm tra token còn hợp lệ không (gọi khi reload trang)
       */
      checkAuth: async () => {
        const { token, loginAt } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null, loginAt: null, isLoading: false });
          return;
        }

        if (!loginAt || Date.now() - loginAt > AUTH_SESSION_TTL_MS) {
          set({
            user: null,
            token: null,
            loginAt: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await authAPI.getMe();
          const { user } = response.data.data;
          set({
            user,
            loginAt,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token hết hạn hoặc không hợp lệ
          set({
            user: null,
            token: null,
            loginAt: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      /**
       * Kiểm tra user có role nào trong danh sách không
       */
      hasRole: (...roles: UserRole[]) => {
        const { user } = get();
        if (!user) return false;
        return roles.includes(user.role);
      },
    }),
    {
      name: 'sora-pos-auth', // localStorage key
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        loginAt: state.loginAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
