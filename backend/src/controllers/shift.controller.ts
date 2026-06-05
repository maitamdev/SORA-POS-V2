import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { ShiftService } from '../services/shift.service';

export class ShiftController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await ShiftService.list(req.query), 'Lấy danh sách ca làm thành công');
  });

  static get = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await ShiftService.getById(req.params.id), 'Lấy chi tiết ca làm thành công');
  });

  static open = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.open(req.body, req.user.userId), 'Mở ca làm thành công', 201);
  });

  static active = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.activeForUser(req.user.userId), 'Lấy ca đang mở thành công');
  });

  static myShifts = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.listForEmployee(req.user.userId, req.query), 'Lấy ca làm của tôi thành công');
  });

  static checkIn = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.checkIn(req.user.userId, req.body.opening_cash), 'Nhận ca thành công');
  });

  static close = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.close(req.user.userId, req.body), 'Chốt ca thành công');
  });
}
