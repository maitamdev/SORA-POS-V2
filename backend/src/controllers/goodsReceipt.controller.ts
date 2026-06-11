import { Request, Response } from 'express';
import { GoodsReceiptService } from '../services/goodsReceipt.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export class GoodsReceiptController {
  /**
   * POST /api/stock/receipts
   * Tạo phiếu nhập kho mới
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Yêu cầu đăng nhập để thực hiện');
    }

    const result = await GoodsReceiptService.create(req.body, req.user.userId);
    successResponse(res, result, 'Tạo phiếu nhập kho thành công', 201);
  });

  /**
   * GET /api/stock/receipts
   * Lấy danh sách phiếu nhập kho
   */
  static list = asyncHandler(async (req: Request, res: Response) => {
    const result = await GoodsReceiptService.list(req.query);
    successResponse(res, result, 'Lấy danh sách phiếu nhập thành công');
  });

  /**
   * GET /api/stock/receipts/:id
   * Chi tiết phiếu nhập kho
   */
  static getById = asyncHandler(async (req: Request, res: Response) => {
    const result = await GoodsReceiptService.getById(req.params.id);
    successResponse(res, result, 'Lấy chi tiết phiếu nhập thành công');
  });

  /**
   * PATCH /api/stock/receipts/:id/payment
   * Cập nhật số tiền đã thanh toán (trả thêm nợ)
   */
  static updatePayment = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Yêu cầu đăng nhập để thực hiện');
    }

    const { id } = req.params;
    const { pay_amount } = req.body;

    if (pay_amount === undefined || pay_amount === null) {
      throw new AppError(400, 'Thiếu số tiền thanh toán thêm (pay_amount)');
    }

    const result = await GoodsReceiptService.updatePayment(id, Number(pay_amount), req.user.userId);
    successResponse(res, result, 'Cập nhật thanh toán thành công');
  });
}
