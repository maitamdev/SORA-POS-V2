import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { errorResponse } from '../utils/response';

/**
 * Validate Middleware - Kiểm tra request body bằng Zod schema
 *
 * @example
 * router.post('/login', validateMiddleware(loginSchema), controller);
 */
export const validateMiddleware = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      errorResponse(res, 'Dữ liệu không hợp lệ', 422, errors);
      return;
    }

    // Gán validated data vào body (đã được sanitize)
    req.body = result.data;
    next();
  };
};
