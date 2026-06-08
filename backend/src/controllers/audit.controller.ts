import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';

export class AuditController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await AuditService.list(req.query), 'Lay nhat ky he thong thanh cong');
  });
}
