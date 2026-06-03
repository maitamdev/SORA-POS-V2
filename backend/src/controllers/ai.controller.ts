import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class AIController {
  static generate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(
      res,
      await AIService.generateRecommendations(req.body.target_days || 14, req.user.userId, req.body.product_id),
      'Tạo gợi ý nhập hàng thành công',
      201
    );
  });

  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await AIService.list(req.query), 'Lấy danh sách gợi ý AI thành công');
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    successResponse(
      res,
      await AIService.updateStatus(req.params.id, req.body.status),
      'Cập nhật trạng thái gợi ý thành công'
    );
  });

  static generateDescription = asyncHandler(async (req: Request, res: Response) => {
    const { productName } = req.body;
    if (!productName) throw new AppError(400, 'Vui lòng cung cấp tên sản phẩm');
    const description = await AIService.generateDescription(productName);
    successResponse(res, { description }, 'Sinh mô tả sản phẩm thành công');
  });

  static suggestCategory = asyncHandler(async (req: Request, res: Response) => {
    const { productName, categories } = req.body;
    if (!productName || !categories || !Array.isArray(categories)) {
      throw new AppError(400, 'Tham số không hợp lệ. Cần có productName và danh sách categories');
    }
    const categoryId = await AIService.suggestCategory(productName, categories);
    successResponse(res, { categoryId }, 'Gợi ý danh mục sản phẩm thành công');
  });
}
