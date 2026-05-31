export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role_id: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithRole extends Omit<User, 'password_hash'> {
  role: UserRole;
  role_name: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Augment Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
