import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types/user.type';
import { errorResponse } from '../utils/response';

/**
 * Auth Middleware - Verify JWT token
 * Lấy token từ header Authorization: Bearer <token>
 * Decode và gắn user info vào req.user
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errorResponse(res, 'Token không được cung cấp', 401);
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      errorResponse(res, 'Token đã hết hạn', 401);
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      errorResponse(res, 'Token không hợp lệ', 401);
      return;
    }
    errorResponse(res, 'Lỗi xác thực', 401);
  }
};
