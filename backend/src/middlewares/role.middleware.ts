import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/user.type';
import { errorResponse } from '../utils/response';

/**
 * Role Middleware - Kiểm tra vai trò người dùng
 * Sử dụng SAU authMiddleware
 *
 * @example
 * router.get('/admin-only', authMiddleware, roleMiddleware('admin'), controller);
 * router.get('/managers', authMiddleware, roleMiddleware('admin', 'manager'), controller);
 */
export const roleMiddleware = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Chưa xác thực', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      errorResponse(
        res,
        `Bạn không có quyền truy cập. Yêu cầu vai trò: ${allowedRoles.join(', ')}`,
        403
      );
      return;
    }

    next();
  };
};
