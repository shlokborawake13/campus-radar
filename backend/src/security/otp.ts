import crypto from 'crypto';
import { env } from '../config/env.js';

export function generateSecureOTP(): string {
  // Generate a cryptographically secure 6-digit number (100000 - 999999)
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

export function hashOTP(otp: string): string {
  return crypto
    .createHmac('sha256', env.OTP_SALT)
    .update(otp)
    .digest('hex');
}

export function verifyOTPHash(otp: string, hash: string): boolean {
  const computedHash = hashOTP(otp);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}
