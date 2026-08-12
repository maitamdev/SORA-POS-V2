import { Request, Response, NextFunction } from 'express';

/**
 * Middleware setting HTTP Cache-Control header for idempotent GET responses.
 * @param maxAgeSeconds Max-age in seconds for client/browser cache (default: 60s)
 * @param staleWhileRevalidateSeconds Stale-while-revalidate duration in seconds (default: 120s)
 */
export const httpCacheMiddleware = (maxAgeSeconds = 60, staleWhileRevalidateSeconds = 120) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      // These routes are mounted behind authMiddleware. A public cache header
      // allows a browser/CDN to reuse one user's response for another user.
      // Keep the browser speed-up, but make the response explicitly private.
      res.setHeader('Vary', 'Authorization, Accept-Encoding');
      res.setHeader(
        'Cache-Control',
        `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
      );
    }
    next();
  };
};

/**
 * Settings are operational state, so a browser or proxy must always request
 * the latest value after an administrator saves a change.
 */
export const noStoreHttpCacheMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.setHeader('Vary', 'Authorization, Accept-Encoding');
      res.setHeader('Cache-Control', 'no-store, max-age=0');
    }
    next();
  };
};
