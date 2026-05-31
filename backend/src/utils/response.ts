import { Response } from 'express';

/**
 * Response thành công
 */
export const successResponse = (
  res: Response,
  data: unknown = null,
  message: string = 'Thành công',
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Response lỗi
 */
export const errorResponse = (
  res: Response,
  message: string = 'Có lỗi xảy ra',
  statusCode: number = 500,
  errors: unknown = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
