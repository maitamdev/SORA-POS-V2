import { Request, Response } from 'express';
import { StaffService } from '../services/staff.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export class StaffController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await StaffService.list(req.query), 'Lấy danh sách nhân viên thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await StaffService.create(req.body), 'Tạo tài khoản nhân viên thành công', 201);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await StaffService.update(req.params.id, req.body), 'Cập nhật nhân viên thành công');
  });

  static deactivate = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await StaffService.deactivate(req.params.id), 'Đã vô hiệu hóa tài khoản nhân viên');
  });
}
