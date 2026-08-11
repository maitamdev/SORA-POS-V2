import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

const normalizeRequestId = (value: string | undefined) => {
  const trimmed = value?.trim() || '';
  return REQUEST_ID_PATTERN.test(trimmed) ? trimmed : randomUUID();
};

/**
 * Attach a stable trace id to every API request. Vercel can recycle instances,
 * so the id is also returned to the browser for support/debug correlation.
 * Slow requests are logged without logging every successful request in prod.
 */
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = normalizeRequestId(req.header('x-request-id'));
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (durationMs >= 750) {
      console.warn('[HTTP] slow request', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    }
  });

  next();
};

