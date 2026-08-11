import { Request, Response } from 'express';
import { PromotionService } from '../services/promotion.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export class PromotionController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PromotionService.list(req.query), 'Lấy danh sách khuyến mãi thành công');
  });

  static get = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PromotionService.getById(req.params.id), 'Lấy khuyến mãi thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    successResponse(res, await PromotionService.create(req.body, userId), 'Tạo khuyến mãi thành công', 201);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PromotionService.update(req.params.id, req.body), 'Cập nhật khuyến mãi thành công');
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PromotionService.delete(req.params.id), 'Xóa khuyến mãi thành công');
  });

  static validate = asyncHandler(async (req: Request, res: Response) => {
    const { code, order_total, items } = req.body;
    successResponse(res, await PromotionService.validateCode(code, order_total, items), 'Mã khuyến mãi hợp lệ');
  });

  static autoPromotions = asyncHandler(async (req: Request, res: Response) => {
    const { order_total, items } = req.body;
    // Auto promotion lookup is called while the cart changes. A stale client
    // payload must not turn a non-critical lookup into a 500 response.
    const parsedOrderTotal = Number(order_total);
    const safeOrderTotal = Number.isFinite(parsedOrderTotal) && parsedOrderTotal >= 0
      ? parsedOrderTotal
      : 0;
    const safeItems = Array.isArray(items) ? items : [];

    successResponse(
      res,
      await PromotionService.getAutoPromotions(safeOrderTotal, safeItems),
      'Lấy khuyến mãi tự động thành công'
    );
  });
}
