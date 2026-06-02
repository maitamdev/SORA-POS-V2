import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { successResponse, errorResponse } from '../utils/response';

export class AIController {
  static async generate(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Chưa xác thực', 401);
        return;
      }
      successResponse(
        res,
        await AIService.generateRecommendations(req.body.target_days || 14, req.user.userId, req.body.product_id),
        'Tạo gợi ý nhập hàng thành công',
        201
      );
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi tạo gợi ý AI', err.status || 500);
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await AIService.list(req.query), 'Lấy danh sách gợi ý AI thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi lấy gợi ý AI', err.status || 500);
    }
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      successResponse(
        res,
        await AIService.updateStatus(req.params.id, req.body.status),
        'Cập nhật trạng thái gợi ý thành công'
      );
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi cập nhật gợi ý AI', err.status || 500);
    }
  }

  static async generateDescription(req: Request, res: Response): Promise<void> {
    try {
      const { productName } = req.body;
      if (!productName) {
        errorResponse(res, 'Vui lòng cung cấp tên sản phẩm', 400);
        return;
      }
      const description = await AIService.generateDescription(productName);
      successResponse(res, { description }, 'Sinh mô tả sản phẩm thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi sinh mô tả AI', err.status || 500);
    }
  }

  static async suggestCategory(req: Request, res: Response): Promise<void> {
    try {
      const { productName, categories } = req.body;
      if (!productName || !categories || !Array.isArray(categories)) {
        errorResponse(res, 'Tham số không hợp lệ. Cần có productName và danh sách categories', 400);
        return;
      }
      const categoryId = await AIService.suggestCategory(productName, categories);
      successResponse(res, { categoryId }, 'Gợi ý danh mục sản phẩm thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi gợi ý danh mục AI', err.status || 500);
    }
  }
}
