import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Fields that must NEVER be stored in audit logs
const SENSITIVE_FIELDS = ['password', 'totpCode', 'refreshToken', 'otp', 'accessToken', 'token', 'secret', 'totp_secret'];

function redactSensitiveFields(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactSensitiveFields(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function logAdminAction(action: string, targetType?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Intercept response finish event to ensure we only log successful actions or actual completion
    res.on('finish', async () => {
      if (res.statusCode < 400 && req.user) {
        try {
          const targetId = req.params.id || req.body.id || req.body.targetId || null;
          const ip = req.ip || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'] || null;

          await query(
            `INSERT INTO audit_logs 
             (actor_id, actor_email, actor_role, action, target_type, target_id, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              req.user.id,
              req.user.email,
              req.user.role,
              action,
              targetType || null,
              targetId,
              JSON.stringify({
                params: redactSensitiveFields(req.params),
                body: redactSensitiveFields(req.body),
                status: res.statusCode
              }),
              ip,
              userAgent
            ]
          );
        } catch (err: any) {
          logger.error('Failed to write audit log entry', { error: err.message, action });
        }
      }
    });

    next();
  };
}

