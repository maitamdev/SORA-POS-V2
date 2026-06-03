import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Global Error Handler Middleware
 * Phải đặt SAU tất cả routes trong app.ts
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Unhandled Error:', err.message);

  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      errors: null,
    });
    return;
  }

  // Log full stack trace cho lỗi không xác định
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Có lỗi xảy ra, vui lòng thử lại'
      : err.message,
    errors: null,
  });
};
