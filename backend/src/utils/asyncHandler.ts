import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { errorResponse } from './response';
import { env } from '../config/env';

/**
 * Async Handler Wrapper
 * Bọc controller method để tự động catch error và trả response lỗi chuẩn
 * Loại bỏ boilerplate try-catch trong từng controller method
 *
 * @example
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await SomeService.list(req.query);
 *   successResponse(res, data, 'Thành công');
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch((error: unknown) => {
      // AppError: lỗi do logic nghiệp vụ (có status code rõ ràng)
      if (error instanceof AppError) {
        errorResponse(res, error.message, error.status);
        return;
      }

      // Lỗi không xác định: log chi tiết ra server, trả message chung cho client
      console.error('❌ Unhandled Error:', error);

      const message =
        env.nodeEnv === 'production'
          ? 'Có lỗi xảy ra, vui lòng thử lại'
          : (error as Error).message || 'Internal Server Error';

      errorResponse(res, message, 500);
    });
  };
};
