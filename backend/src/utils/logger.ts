type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// Keys whose values should be automatically redacted when logged
const REDACT_KEYS = [
  'password', 'password_hash', 'passwordHash',
  'token', 'accessToken', 'refreshToken',
  'otp', 'totpCode', 'totp_secret', 'secret',
  'authorization', 'cookie'
];

function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACT_KEYS.includes(key.toLowerCase()) || REDACT_KEYS.includes(key)) {
      safe[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      safe[key] = redactMeta(value as Record<string, unknown>);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    level,
    message,
    ...(meta ? { meta: redactMeta(meta) } : {})
  };
  return JSON.stringify(payload);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(formatLog('info', message, meta));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(formatLog('warn', message, meta));
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(formatLog('error', message, meta));
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', message, meta));
    }
  }
};

