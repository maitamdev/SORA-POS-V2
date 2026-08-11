import { Request, Response } from 'express';
import { PurchaseOrderService } from '../services/purchaseOrder.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { AppError } from '../utils/AppError';

const userId = (req: Request) => {
  if (!req.user) throw new AppError(401, 'Yêu cầu đăng nhập để thực hiện');
  return req.user.userId;
};

export class PurchaseOrderController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PurchaseOrderService.list(req.query), 'Lấy danh sách đơn nhập hàng thành công');
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PurchaseOrderService.getById(req.params.id), 'Lấy chi tiết đơn nhập hàng thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PurchaseOrderService.create(req.body, userId(req)), 'Tạo đơn nhập hàng thành công', 201);
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PurchaseOrderService.updateStatus(req.params.id, req.body.status, userId(req)), 'Cập nhật trạng thái đơn nhập hàng thành công');
  });

  static receive = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await PurchaseOrderService.receive(req.params.id, req.body, userId(req)), 'Nhận hàng và cập nhật tồn kho thành công');
  });
}
