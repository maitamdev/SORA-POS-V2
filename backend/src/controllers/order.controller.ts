import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { successResponse, errorResponse } from '../utils/response';

export class OrderController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await OrderService.list(req.query), 'Lấy danh sách hóa đơn thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi lấy danh sách hóa đơn', err.status || 500);
    }
  }

  static async get(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await OrderService.getById(req.params.id), 'Lấy hóa đơn thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi lấy hóa đơn', err.status || 500);
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Chưa xác thực', 401);
        return;
      }
      successResponse(res, await OrderService.create(req.body, req.user.userId), 'Tạo hóa đơn thành công', 201);
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi tạo hóa đơn', err.status || 500);
    }
  }

  static async cancel(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Chưa xác thực', 401);
        return;
      }
      successResponse(
        res,
        await OrderService.cancel(req.params.id, req.user.userId, req.body.restock !== false, req.body.note),
        'Hủy hóa đơn thành công'
      );
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi hủy hóa đơn', err.status || 500);
    }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await OrderService.delete(req.params.id), 'Xóa hóa đơn thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi xóa hóa đơn', err.status || 500);
    }
  }

  static async removeAll(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await OrderService.deleteAll(), 'Xóa toàn bộ hóa đơn thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi xóa toàn bộ hóa đơn', err.status || 500);
    }
  }
}
