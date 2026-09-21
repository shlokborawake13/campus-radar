import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Custom security headers middleware.
 * Supplements Helmet with additional production-grade headers.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID for tracing
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser features
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );

  // HSTS — only in production to avoid local dev issues
  if (env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  // Prevent caching of API responses (but not static assets)
  if (req.path.startsWith('/api') || req.path.startsWith('/' + env.ADMIN_PANEL_SECRET_PATH?.slice(1))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}
