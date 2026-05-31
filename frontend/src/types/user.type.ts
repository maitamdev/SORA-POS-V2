export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  last_login?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}
