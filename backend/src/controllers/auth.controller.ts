import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      successResponse(res, result, 'Đăng nhập thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Đăng nhập thất bại', err.status || 500);
    }
  }

  /**
   * POST /api/auth/logout
   * JWT là stateless nên backend chỉ trả response OK
   * Frontend sẽ xóa token khỏi localStorage
   */
  static async logout(_req: Request, res: Response): Promise<void> {
    successResponse(res, null, 'Đăng xuất thành công');
  }

  /**
   * GET /api/auth/me
   * Lấy thông tin user từ token
   */
  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Chưa xác thực', 401);
        return;
      }
      const user = await AuthService.getProfile(req.user.userId);
      successResponse(res, { user }, 'Xác thực thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi lấy thông tin', err.status || 500);
    }
  }
}
