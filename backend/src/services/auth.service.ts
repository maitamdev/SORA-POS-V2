import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { env } from '../config/env';
import { JwtPayload, UserRole } from '../types/user.type';
import { ShiftService } from './shift.service';
import { EmailService } from './email.service';

type PasswordResetTokenPayload = {
  userId: string;
  email: string;
  purpose: 'password-reset';
  iat?: number;
  exp?: number;
};

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
   * Generate a short-lived reset token and send the reset link. The caller
   * always returns the same message for existing and non-existing accounts.
   */
  static async requestPasswordReset(email: string): Promise<void> {
    const loginId = email.trim().toLowerCase();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, is_active')
      .eq('email', loginId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[AuthService.requestPasswordReset] Không thể tìm tài khoản:', error.message);
      return;
    }

    if (!user) return;

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        purpose: 'password-reset',
      },
      env.jwtSecret,
      { expiresIn: '15m' }
    );
    const resetUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await EmailService.sendPasswordReset(user.email, user.full_name, resetUrl);
    } catch (sendError) {
      // Do not expose SMTP details or account existence through this endpoint.
      console.error('[AuthService.requestPasswordReset] Không thể gửi email:', sendError);
    }
  }

  /**
   * Consume a reset token. updated_at is advanced after a successful reset,
   * which makes the same token unusable if it is replayed later.
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: PasswordResetTokenPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as PasswordResetTokenPayload;
    } catch {
      throw new AppError(400, 'Liên kết khôi phục không hợp lệ hoặc đã hết hạn');
    }

    if (payload.purpose !== 'password-reset' || !payload.userId || !payload.email) {
      throw new AppError(400, 'Liên kết khôi phục không hợp lệ');
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, is_active, updated_at')
      .eq('id', payload.userId)
      .eq('email', payload.email)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      throw new AppError(400, 'Tài khoản không còn hoạt động hoặc không tồn tại');
    }

    const issuedAt = (payload.iat || 0) * 1000;
    const lastUpdatedAt = user.updated_at ? Date.parse(user.updated_at) : 0;
    if (issuedAt > 0 && lastUpdatedAt > issuedAt) {
      throw new AppError(400, 'Liên kết khôi phục đã được sử dụng hoặc không còn hợp lệ');
    }

    const now = new Date(Math.max(Date.now(), issuedAt + 1000)).toISOString();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: now })
      .eq('id', user.id);

    if (updateError) throw new AppError(400, updateError.message);
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash, is_active')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !user) throw new AppError(404, 'Không tìm thấy tài khoản');

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) throw new AppError(401, 'Mật khẩu hiện tại không đúng');
    if (currentPassword === newPassword) {
      throw new AppError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) throw new AppError(400, updateError.message);
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
