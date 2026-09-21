import { env } from '../config/env.js';

export function isAllowedStudentEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  
  // Strict regex check: must match localpart@domain exactly
  const pattern = new RegExp(`^[a-zA-Z0-9._%+-]+@${env.ALLOWED_EMAIL_DOMAIN.replace('.', '\\.')}$`);
  return pattern.test(normalized);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
