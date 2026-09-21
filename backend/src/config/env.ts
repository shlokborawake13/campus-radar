import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.union([z.string(), z.number()]).default('5000').transform((val) => typeof val === 'string' ? parseInt(val, 10) : val),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_MAX_CONNECTIONS: z.union([z.string(), z.number()]).default('20').transform((v) => typeof v === 'string' ? parseInt(v, 10) : v),
  DB_IDLE_TIMEOUT_MS: z.union([z.string(), z.number()]).default('30000').transform((v) => typeof v === 'string' ? parseInt(v, 10) : v),
  DB_CONNECTION_TIMEOUT_MS: z.union([z.string(), z.number()]).default('30000').transform((v) => typeof v === 'string' ? parseInt(v, 10) : v),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RATE_LIMIT_WINDOW_MS: z.union([z.string(), z.number()]).default('900000').transform((v) => typeof v === 'string' ? parseInt(v, 10) : v),
  RATE_LIMIT_MAX_REQUESTS: z.union([z.string(), z.number()]).default('100').transform((v) => typeof v === 'string' ? parseInt(v, 10) : v),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'),
  ADMIN_PANEL_SECRET_PATH: z.string().default('/sec-admin-gateway-7x9q'),
  OTP_EXPIRY_MINUTES: z.union([z.string(), z.number()]).default('10').transform((v) => typeof v === 'string' ? parseInt(v, 10) : v),
  OTP_SALT: z.string().min(16, 'OTP_SALT must be at least 16 characters'),
  TOTP_ISSUER: z.string().default('CampusRadar'),
  ALLOWED_EMAIL_DOMAIN: z.string().default('sanjivani.edu.in'),

  // Supabase
  SUPABASE_URL: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().optional(),

  // SMTP Email Server Configuration
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.union([z.string(), z.number()]).default('465').transform((v) => typeof v === 'string' ? parseInt(v, 10) : v),
  SMTP_SECURE: z.union([z.string(), z.boolean()]).default('true').transform((v) => typeof v === 'string' ? v === 'true' : v),
  SMTP_USER: z.string().default('admin132212@gmail.com'),
  SMTP_PASS: z.string().default('jmizwvcnwqxjsxkn'),
  SMTP_FROM: z.string().default('Campus Radar <admin132212@gmail.com>')
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (data.JWT_ACCESS_SECRET.includes('REPLACE_ME')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET must not use placeholder values in production'
      });
    }
    if (data.JWT_REFRESH_SECRET.includes('REPLACE_ME')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must not use placeholder values in production'
      });
    }
    if (data.OTP_SALT.includes('REPLACE_ME')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OTP_SALT'],
        message: 'OTP_SALT must not use placeholder values in production'
      });
    }
  }
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // SECURITY: Only log field names and validation messages, never raw values.
    // Zod's format() output can contain the actual secret values on parse failure.
    const formatted = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    console.error('Invalid environment variables:');
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();

