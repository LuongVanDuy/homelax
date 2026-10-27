import type { NextFunction, Request, Response } from 'express';

export function securityHeaders(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)',
  );

  // Nest v2 is an application API. Browser/proxy caching is disabled by
  // default so authenticated responses cannot become shared/stale cache.
  // Endpoints with immutable binary output (image transform) may override it.
  response.setHeader(
    'Cache-Control',
    'private, no-store, max-age=0, must-revalidate',
  );

  next();
}
