import { query } from '../config/database.js';
import { generateSecureOTP, hashOTP, verifyOTPHash } from '../security/otp.js';
import { env } from '../config/env.js';
import { BadRequestError, TooManyRequestsError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const otpService = {
  async generateAndSave(identifier: string, purpose: string): Promise<string> {
    const normIdentifier = identifier.toLowerCase().trim();

    // Check recent attempts within last 60 seconds (rate-limit spamming resend)
    const recentRes = await query(
      `SELECT created_at FROM otps 
       WHERE identifier = $1 AND purpose = $2 AND created_at > (CURRENT_TIMESTAMP - INTERVAL '60 seconds')`,
      [normIdentifier, purpose]
    );

    if (recentRes.rowCount && recentRes.rowCount > 0) {
      logger.warn('OTP rate limit triggered on resend', { identifier: normIdentifier, purpose });
      throw new TooManyRequestsError('Please wait 60 seconds before requesting another code');
    }

    // Invalidate previous pending unused OTPs for this identifier & purpose
    await query(
      `UPDATE otps SET is_used = TRUE WHERE identifier = $1 AND purpose = $2 AND is_used = FALSE`,
      [normIdentifier, purpose]
    );

    const rawOtp = generateSecureOTP();
    const hashed = hashOTP(rawOtp);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO otps (identifier, otp_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normIdentifier, hashed, purpose, expiresAt]
    );

    logger.info('Generated new verification OTP', {
      identifier: normIdentifier,
      purpose,
      expiresAt: expiresAt.toISOString()
    });

    return rawOtp;
  },

  async verify(identifier: string, purpose: string, rawOtp: string): Promise<boolean> {
    const normIdentifier = identifier.toLowerCase().trim();

    const res = await query(
      `SELECT id, otp_hash, attempts, max_attempts, expires_at 
       FROM otps 
       WHERE identifier = $1 AND purpose = $2 AND is_used = FALSE 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [normIdentifier, purpose]
    );

    if (res.rowCount === 0) {
      logger.warn('OTP verification failed: no active code found', { identifier: normIdentifier, purpose });
      throw new BadRequestError('No active verification code found. Please request a new one.');
    }

    const record = res.rows[0];

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      await query('UPDATE otps SET is_used = TRUE WHERE id = $1', [record.id]);
      logger.warn('OTP verification failed: code expired', { identifier: normIdentifier, purpose });
      throw new BadRequestError('Verification code has expired. Please request a new one.');
    }

    // Check attempts
    if (record.attempts >= record.max_attempts) {
      await query('UPDATE otps SET is_used = TRUE WHERE id = $1', [record.id]);
      logger.warn('OTP verification failed: max attempts exceeded', { identifier: normIdentifier, purpose });
      throw new BadRequestError('Too many failed attempts. This code is now invalid. Please request a new one.');
    }

    // Verify OTP
    const isValid = verifyOTPHash(rawOtp, record.otp_hash);

    if (!isValid) {
      await query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      logger.warn('OTP verification failed: invalid code attempt', {
        identifier: normIdentifier,
        purpose,
        attempt: record.attempts + 1,
        remainingAttempts: record.max_attempts - (record.attempts + 1)
      });
      throw new BadRequestError('Incorrect verification code. Please try again.');
    }

    // Mark as used
    await query('UPDATE otps SET is_used = TRUE WHERE id = $1', [record.id]);
    logger.info('OTP verification successful', { identifier: normIdentifier, purpose });
    return true;
  }
};

