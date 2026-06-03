import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  static login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    successResponse(res, result, 'Đăng nhập thành công');
  });

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
  static getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    const user = await AuthService.getProfile(req.user.userId);
    successResponse(res, { user }, 'Xác thực thành công');
  });
}
