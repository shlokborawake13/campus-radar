import dns from 'node:dns';
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { requestTiming } from './middleware/timing.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { corsMiddleware } from './config/cors.js';
import { globalLimiter } from './config/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { NotFoundError } from './utils/errors.js';
import { logger } from './utils/logger.js';

import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

// 1. CORS middleware FIRST to ensure OPTIONS preflight and cross-origin headers are applied before any other middleware
app.use(corsMiddleware);
app.options('*', corsMiddleware);

// 2. High-resolution request timing & Server-Timing headers
app.use(requestTiming);

// 3. Response compression for text/json payloads > 1KB (reduces network transfer times)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// 4. Trust first proxy (required for correct IP in rate-limiting & audit logs behind reverse proxies)
app.set('trust proxy', 1);

// 5. Security HTTP headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

// 6. Custom security headers (X-Request-ID, HSTS, Permissions-Policy, etc.)
app.use(securityHeaders);

// 7. JSON body parsing with payload size limits (prevents memory exhaustion DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 8. Global Rate Limiting
app.use(globalLimiter);

// Strict Cache-Control for all dynamic API endpoints (prevents leakage of personalized is_liked/is_saved/profile state)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Static assets (for local fallback image uploads)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), {
  maxAge: '7d',
  immutable: true
}));

// Root status endpoint for platform probes and API inspection
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'campus-radar-backend',
    version: '1.0.0',
    health: '/health'
  });
});
app.head('/', (_req, res) => {
  res.status(200).end();
});

// Root API status endpoint
app.get('/api', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'campus-radar-api',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      posts: '/api/posts',
      events: '/api/events',
      confessions: '/api/confessions'
    }
  });
});
app.head('/api', (_req, res) => {
  res.status(200).end();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ status: 'ok', service: 'campus-radar-backend', timestamp: new Date().toISOString() });
});

// SMTP health check — verifies transporter can connect to Gmail SMTP
// NOTE: This endpoint does NOT send any email, it only tests the connection.
app.get('/health/smtp', async (_req, res) => {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');
    const isGmail = smtpHost.includes('gmail.com') || smtpUser.includes('@gmail.com');

    if (!smtpUser || !smtpPass) {
      res.status(500).json({
        status: 'error',
        message: 'SMTP credentials missing from environment',
        hasHost: !!smtpHost,
        hasUser: !!smtpUser,
        hasPass: !!smtpPass
      });
      return;
    }

    let testTransporter;
    if (isGmail) {
      testTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
      });
    } else {
      testTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: true,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        tls: { rejectUnauthorized: false }
      });
    }

    await testTransporter.verify();
    testTransporter.close();

    res.status(200).json({
      status: 'ok',
      smtp: 'verified',
      host: smtpHost,
      user: smtpUser.substring(0, 5) + '***',
      isGmail,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      smtp: 'failed',
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
  }
});

// CRITICAL SECURITY REQUIREMENT:
// Public route '/admin' returns 404 for EVERYONE (no security through obscurity reliance,
// but completely prevents discovery of admin portal via common URL guessing).
app.all('/admin', (_req, _res, next) => {
  next(new NotFoundError('Cannot GET /admin'));
});

// Auth Routes
app.use('/api/auth', authRoutes);

// Student Social Routes
app.use('/api', studentRoutes);

// Admin Routes mounted on API path AND dynamic secret gateway path
app.use('/api/admin', adminRoutes);
if (env.ADMIN_PANEL_SECRET_PATH) {
  app.use(env.ADMIN_PANEL_SECRET_PATH, adminRoutes);
}

// 404 Not Found Catch-All
app.use((req, _res, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
});

// Central Error Handler
app.use(errorHandler);

// Start server
const PORT = Number(process.env.PORT) || env.PORT || 5000;
const HOST = '0.0.0.0';

let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, HOST, () => {
    logger.info(`Campus Radar Backend Server listening on http://${HOST}:${PORT}`, {
      environment: env.NODE_ENV,
      port: PORT
      // NOTE: Admin secret path intentionally NOT logged to prevent leakage in log files
    });
  });
}

// Graceful shutdown handling
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await pool.end();
        logger.info('PostgreSQL connection pool closed.');
        process.exit(0);
      } catch (err: any) {
        logger.error('Error closing database pool during shutdown', { error: err.message });
        process.exit(1);
      }
    });
  } else {
    try {
      await pool.end();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
