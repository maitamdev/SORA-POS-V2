import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

const parseDays = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 365 ? parsed : fallback;
};

export class ReportController {
  static dashboard = asyncHandler(async (req: Request, res: Response) => {
    const dateStr = req.query.date as string | undefined;
    successResponse(res, await ReportService.dashboard(dateStr), 'Lấy dữ liệu dashboard thành công');
  });

  static revenue = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await ReportService.revenue(parseDays(req.query.days, 30)), 'Lấy báo cáo doanh thu thành công');
  });

  static topProducts = asyncHandler(async (req: Request, res: Response) => {
    successResponse(
      res,
      await ReportService.topProducts(parseDays(req.query.days, 30), parseDays(req.query.limit, 10)),
      'Lấy sản phẩm bán chạy thành công'
    );
  });
}
