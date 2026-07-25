import { Request, Response, NextFunction } from 'express';

/**
 * Middleware setting HTTP Cache-Control header for idempotent GET responses.
 * @param maxAgeSeconds Max-age in seconds for client/browser cache (default: 60s)
 * @param staleWhileRevalidateSeconds Stale-while-revalidate duration in seconds (default: 120s)
 */
export const httpCacheMiddleware = (maxAgeSeconds = 60, staleWhileRevalidateSeconds = 120) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.setHeader(
        'Cache-Control',
        `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
      );
    }
    next();
  };
};
