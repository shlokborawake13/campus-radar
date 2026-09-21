import cors from 'cors';
import { env } from './env.js';

const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // In production, block requests with no Origin header (e.g., curl, server-to-server)
    // to prevent CORS bypass. In development, allow them for API testing tools.
    if (!origin) {
      if (env.NODE_ENV === 'production') {
        return callback(null, false);
      }
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

    // Check configured allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In production, block without throwing unhandled error
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

export const corsMiddleware = cors(corsOptions);

