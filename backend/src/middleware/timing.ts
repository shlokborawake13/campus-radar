import { Request, Response, NextFunction } from 'express';
import { performance } from 'node:perf_hooks';
import { logger } from '../utils/logger.js';

export interface TimedRequest extends Request {
  startTime?: number;
  timings?: { [key: string]: number };
}

export function requestTiming(req: TimedRequest, res: Response, next: NextFunction) {
  const start = performance.now();
  req.startTime = start;
  req.timings = {};

  // Set Server-Timing header before response sent
  const originalSend = res.send;
  res.send = function(body?: any) {
    const totalDuration = performance.now() - start;
    const serverTimingParts = [`total;dur=${totalDuration.toFixed(1)}`];
    if (req.timings) {
      for (const [name, dur] of Object.entries(req.timings)) {
        serverTimingParts.push(`${name};dur=${dur.toFixed(1)}`);
      }
    }
    res.setHeader('Server-Timing', serverTimingParts.join(', '));
    return originalSend.call(this, body);
  };

  res.on('finish', () => {
    const totalDuration = performance.now() - start;
    const statusCode = res.statusCode;
    
    // Log if slow (> 200ms) or on error
    if (totalDuration > 200 || statusCode >= 400) {
      logger.info(`HTTP ${req.method} ${req.originalUrl} [${statusCode}] completed in ${totalDuration.toFixed(1)}ms`, {
        method: req.method,
        path: req.originalUrl,
        statusCode,
        durationMs: totalDuration.toFixed(1)
      });
    }
  });

  next();
}

