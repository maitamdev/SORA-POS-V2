import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { successResponse, errorResponse } from '../utils/response';

const parseDays = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 365 ? parsed : fallback;
};

export class ReportController {
  static async dashboard(req: Request, res: Response): Promise<void> {
    try {
      const dateStr = req.query.date as string | undefined;
      successResponse(res, await ReportService.dashboard(dateStr), 'Lấy dữ liệu dashboard thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi lấy dữ liệu dashboard', err.status || 500);
    }
  }

  static async revenue(req: Request, res: Response): Promise<void> {
    try {
      successResponse(res, await ReportService.revenue(parseDays(req.query.days, 30)), 'Lấy báo cáo doanh thu thành công');
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi lấy báo cáo doanh thu', err.status || 500);
    }
  }

  static async topProducts(req: Request, res: Response): Promise<void> {
    try {
      successResponse(
        res,
        await ReportService.topProducts(parseDays(req.query.days, 30), parseDays(req.query.limit, 10)),
        'Lấy sản phẩm bán chạy thành công'
      );
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      errorResponse(res, err.message || 'Lỗi lấy sản phẩm bán chạy', err.status || 500);
    }
  }
}
