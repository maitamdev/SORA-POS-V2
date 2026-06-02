import { Request, Response } from 'express';
import { StockService } from '../services/stock.service';
import { successResponse, errorResponse } from '../utils/response';

const handleError = (res: Response, error: unknown, fallback: string) => {
  const err = error as { status?: number; message?: string };
  errorResponse(res, err.message || fallback, err.status || 500);
};

export class StockController {
  static async inventory(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await StockService.inventory(req.query), 'Lấy tồn kho thành công');
    } catch (error) {
      handleError(res, error, 'Lỗi lấy tồn kho');
    }
  }

  static async alerts(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await StockService.alerts(req.query), 'Lấy cảnh báo tồn kho thành công');
    } catch (error) {
      handleError(res, error, 'Lỗi lấy cảnh báo tồn kho');
    }
  }

  static async transactions(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await StockService.transactions(req.query), 'Lấy lịch sử kho thành công');
    } catch (error) {
      handleError(res, error, 'Lỗi lấy lịch sử kho');
    }
  }

  static async importStock(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Chưa xác thực', 401);
        return;
      }
      successResponse(
        res,
        await StockService.importStock(req.body.product_id, req.body.quantity, req.user.userId, req.body.note),
        'Nhập kho thành công',
        201
      );
    } catch (error) {
      handleError(res, error, 'Lỗi nhập kho');
    }
  }

  static async adjustStock(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Chưa xác thực', 401);
        return;
      }
      successResponse(
        res,
        await StockService.adjustStock(req.body.product_id, req.body.new_stock, req.user.userId, req.body.note),
        'Điều chỉnh tồn kho thành công'
      );
    } catch (error) {
      handleError(res, error, 'Lỗi điều chỉnh tồn kho');
    }
  }

  static async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Chưa xác thực', 401);
        return;
      }
      successResponse(res, await StockService.resolveAlert(req.params.id, req.user.userId), 'Đã xử lý cảnh báo');
    } catch (error) {
      handleError(res, error, 'Lỗi xử lý cảnh báo');
    }
  }
}
