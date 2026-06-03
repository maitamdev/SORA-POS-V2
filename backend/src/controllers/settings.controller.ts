import { Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { successResponse } from '../utils/response';

export class SettingsController {
  static getOperation = asyncHandler(async (_req: Request, res: Response) => {
    successResponse(res, await SettingsService.getOperationSettings(), 'Lấy cài đặt vận hành thành công');
  });

  static updateOperation = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(
      res,
      await SettingsService.updateOperationSettings(req.body, req.user.userId),
      'Đã lưu cài đặt vận hành'
    );
  });

  static defaults = asyncHandler(async (_req: Request, res: Response) => {
    successResponse(res, SettingsService.getDefaults(), 'Lấy cài đặt mặc định thành công');
  });
}
