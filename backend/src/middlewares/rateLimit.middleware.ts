import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

export const rateLimitMiddleware = ({ windowMs, max, keyPrefix }: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (buckets.size > 10000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      errorResponse(res, 'Quá nhiều yêu cầu, vui lòng thử lại sau', 429);
      return;
    }

    next();
  };
};
