import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class OrderController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await OrderService.list(req.query), 'Lấy danh sách hóa đơn thành công');
  });

  static get = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await OrderService.getById(req.params.id), 'Lấy hóa đơn thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await OrderService.create(req.body, req.user.userId), 'Tạo hóa đơn thành công', 201);
  });

  static cancel = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(
      res,
      await OrderService.cancel(req.params.id, req.user.userId, req.body.restock !== false, req.body.note),
      'Hủy hóa đơn thành công'
    );
  });

  static deleteAll = asyncHandler(async (_req: Request, res: Response) => {
    successResponse(res, await OrderService.deleteAll(), 'Xóa toàn bộ hóa đơn thành công');
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await OrderService.delete(req.params.id), 'Xóa hóa đơn thành công');
  });
}
