import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { JwtPayload, UserRole } from '../types/user.type';
import { errorResponse } from '../utils/response';
import { appCache, stableCacheKey } from '../utils/cache';

const AUTH_USER_CACHE_TTL_MS = 15_000;
type ActiveUser = { id: string; email: string; roles: unknown };

const getRoleName = (roles: unknown): UserRole | null => {
  if (!roles) return null;
  if (Array.isArray(roles)) return (roles[0] as { name?: UserRole })?.name || null;
  return (roles as { name?: UserRole }).name || null;
};

/**
 * Verify JWT and re-load the current active user from the database.
 * This prevents deactivated users or changed roles from continuing with a stale token.
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errorResponse(res, 'Token không được cung cấp', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;

    if (!decoded?.userId) {
      errorResponse(res, 'Token không hợp lệ', 401);
      return;
    }

    const cacheKey = stableCacheKey('auth:user', { id: decoded.userId });
    let user = appCache.get<ActiveUser>(cacheKey);

    if (!user) {
      const result = await supabase
        .from('users')
        .select('id, email, is_active, roles!inner(name)')
        .eq('id', decoded.userId)
        .eq('is_active', true)
        .single();

      if (result.error && result.error.code !== 'PGRST116') {
        errorResponse(res, 'Hệ thống đang quá tải, vui lòng thử lại sau', 500);
        return;
      }

      if ((result.error && result.error.code === 'PGRST116') || !result.data) {
        errorResponse(res, 'Tài khoản không còn hoạt động hoặc không tồn tại', 401);
        return;
      }

      user = {
        id: result.data.id,
        email: result.data.email,
        roles: result.data.roles,
      };
      appCache.set(cacheKey, user, AUTH_USER_CACHE_TTL_MS);
    }

    const role = getRoleName(user.roles);
    if (!role) {
      errorResponse(res, 'Tài khoản chưa được gán vai trò hợp lệ', 403);
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      errorResponse(res, 'Token da het han', 401);
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      errorResponse(res, 'Token không hợp lệ', 401);
      return;
    }
    errorResponse(res, 'Lỗi xác thực', 401);
  }
};
