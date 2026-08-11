import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Global Error Handler Middleware
 * Phải đặt SAU tất cả routes trong app.ts
 */
export const errorHandler = (
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status || err.statusCode || 500;
  
  if (status !== 500) {
    res.status(status).json({
      success: false,
      message: err.message,
      errors: null,
      request_id: req.requestId || null,
    });
    return;
  }

  // Lỗi 500
  console.error('❌ Unhandled Error:', err.message);
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Có lỗi xảy ra, vui lòng thử lại'
      : err.message,
    errors: null,
    request_id: req.requestId || null,
  });
};
