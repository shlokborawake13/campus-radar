import cors from 'cors';
import { env } from './env.js';

const configuredOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

// Explicitly whitelist production origins and configured origins
const allowedOriginsSet = new Set([
  'https://campus-radar-brown.vercel.app',
  'https://campus-radar.vercel.app',
  ...configuredOrigins
]);

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (such as mobile apps, curl, server-to-server, or same-origin proxies)
    if (!origin) {
      return callback(null, true);
    }

    // In development mode, automatically allow any localhost or 127.0.0.1 port (3000, 3001, 5173, etc.)
    if (env.NODE_ENV !== 'production') {
      const isLocalhost = 
        origin.startsWith('http://localhost:') || 
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://localhost:');
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    // Check configured and explicitly allowed origins
    if (allowedOriginsSet.has(origin)) {
      return callback(null, true);
    }

    // Allow official and preview Vercel deployments for Campus Radar
    if (/^https:\/\/campus-radar[a-z0-9-]*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // In production, block without throwing unhandled error
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Server-Timing', 'X-Request-ID'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

export const corsMiddleware = cors(corsOptions);


