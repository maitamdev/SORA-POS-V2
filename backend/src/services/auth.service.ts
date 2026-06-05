import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { env } from '../config/env';
import { JwtPayload, UserRole } from '../types/user.type';
import { ShiftService } from './shift.service';

// Helper: lấy role name từ Supabase join result
const getRoleName = (roles: unknown): UserRole => {
  if (Array.isArray(roles)) return (roles[0] as { name: string }).name as UserRole;
  return (roles as { name: string }).name as UserRole;
};

export class AuthService {
  /**
   * Đăng nhập - tìm user theo email, so sánh password, tạo JWT
   */
  static async login(email: string, password: string) {
    const loginId = email.trim().toLowerCase();

    // 1. Tìm user theo email (JOIN với roles)
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        roles!inner (
          name
        )
      `)
      .eq('email', loginId)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      throw new AppError(401, 'Email hoặc mật khẩu không đúng');
    }

    // 2. So sánh password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError(401, 'Email hoặc mật khẩu không đúng');
    }

    const role = getRoleName(user.roles);
    if (role === 'cashier') {
      await ShiftService.verifyCashierLogin(user.id);
    }

    // 3. Tạo JWT token
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role,
    };

    const signOptions: SignOptions = {
      expiresIn: env.jwtExpiresIn as string & SignOptions['expiresIn'],
    };
    const token = jwt.sign(payload, env.jwtSecret, signOptions);

    // 4. Cập nhật last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // 5. Trả về user data (loại bỏ password_hash)
    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        avatar_url: user.avatar_url,
        role,
        is_active: user.is_active,
        last_login: user.last_login,
      },
      token,
    };
  }

  /**
   * Lấy thông tin user theo ID (verify token)
   */
  static async getProfile(userId: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, email, full_name, phone, avatar_url, is_active, last_login,
        roles!inner (
          name
        )
      `)
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      throw new AppError(404, 'Không tìm thấy người dùng');
    }

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      role: getRoleName(user.roles),
      is_active: user.is_active,
      last_login: user.last_login,
    };
  }
}
