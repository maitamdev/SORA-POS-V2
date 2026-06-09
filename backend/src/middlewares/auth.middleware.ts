import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { JwtPayload, UserRole } from '../types/user.type';
import { errorResponse } from '../utils/response';

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
      errorResponse(res, 'Token khong duoc cung cap', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;

    if (!decoded?.userId) {
      errorResponse(res, 'Token khong hop le', 401);
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, is_active, roles!inner(name)')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      errorResponse(res, 'Hệ thống đang quá tải, vui lòng thử lại sau', 500);
      return;
    }

    if ((error && error.code === 'PGRST116') || !user) {
      errorResponse(res, 'Tai khoan khong con hoat dong hoac khong ton tai', 401);
      return;
    }

    const role = getRoleName(user.roles);
    if (!role) {
      errorResponse(res, 'Tai khoan chua duoc gan vai tro hop le', 403);
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
      errorResponse(res, 'Token khong hop le', 401);
      return;
    }
    errorResponse(res, 'Loi xac thuc', 401);
  }
};
