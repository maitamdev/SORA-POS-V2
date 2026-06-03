import { Request, Response } from 'express';
import { StockService } from '../services/stock.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class StockController {
  static inventory = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await StockService.inventory(req.query), 'Lấy tồn kho thành công');
  });

  static alerts = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await StockService.alerts(req.query), 'Lấy cảnh báo tồn kho thành công');
  });

  static transactions = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await StockService.transactions(req.query), 'Lấy lịch sử kho thành công');
  });

  static importStock = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(
      res,
      await StockService.importStock(req.body.product_id, req.body.quantity, req.user.userId, req.body.note),
      'Nhập kho thành công',
      201
    );
  });

  static adjustStock = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(
      res,
      await StockService.adjustStock(req.body.product_id, req.body.new_stock, req.user.userId, req.body.note),
      'Điều chỉnh tồn kho thành công'
    );
  });

  static resolveAlert = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await StockService.resolveAlert(req.params.id, req.user.userId), 'Đã xử lý cảnh báo');
  });
}
