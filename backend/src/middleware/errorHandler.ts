import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError && err.code ? err.code : 'INTERNAL_SERVER_ERROR';

  // Log based on error severity:
  // 404s and client errors (4xx) are logged cleanly without noisy stack traces.
  // Unexpected server errors (5xx) are logged with full diagnostic details.
  if (statusCode === 404) {
    logger.info(`Not found: ${req.method} ${req.originalUrl}`, {
      path: req.originalUrl,
      method: req.method,
      statusCode: 404
    });
  } else if (statusCode < 500) {
    logger.warn(`Operational request error: ${err.message}`, {
      path: req.originalUrl,
      method: req.method,
      statusCode,
      errorCode
    });
  } else {
    logger.error('Unhandled server error', {
      path: req.originalUrl,
      method: req.method,
      statusCode,
      errorCode,
      message: err.message,
      stack: err.stack
    });
  }

  // SECURITY: Never send stack traces or internal error details in API responses.
  // Only send safe, user-facing error messages.
  const responsePayload: Record<string, any> = {
    status: statusCode,
    error: isAppError ? err.message : 'An unexpected server error occurred',
    code: errorCode
  };

  res.status(statusCode).json(responsePayload);
}

