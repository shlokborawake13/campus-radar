import crypto from 'crypto';
import { userRepo } from '../repositories/user.repo.js';
import { sessionRepo } from '../repositories/session.repo.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../security/jwt.js';
import { isAllowedStudentEmail } from '../security/emailDomain.js';
import { otpService } from './otp.service.js';
import { emailService } from './email.service.js';
import { BadRequestError, UnauthorizedError, ConflictError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Pre-computed dummy hash for timing-safe login (prevents user enumeration via response time)
// This is an argon2id hash of a random string — we never check its result, just burn the same CPU time.
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$dummyhashvaluefortimingnormalization00000000000000';

export const authService = {
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    department?: string;
    graduationYear?: number;
    phoneNumber?: string;
  }) {
    const normalizedEmail = data.email.toLowerCase().trim();
    logger.info('Signup registration requested', { email: normalizedEmail, department: data.department });

    if (!isAllowedStudentEmail(normalizedEmail)) {
      throw new BadRequestError('Only official @sanjivani.edu.in email addresses are permitted');
    }

    const existingUser = await userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      if (existingUser.status === 'pending_verification') {
        logger.info('Signup for pending verification account, regenerating OTP', { email: normalizedEmail, userId: existingUser.id });
        const otp = await otpService.generateAndSave(normalizedEmail, 'registration');
        emailService.sendVerificationOTP(normalizedEmail, otp).catch((err: any) => {
          logger.warn('Asynchronous OTP email dispatch error', { error: err.message, email: normalizedEmail });
        });
        return {
          message: 'Account pending verification. A new verification OTP has been sent to your email.',
          userId: existingUser.id,
          email: normalizedEmail,
          requiresVerification: true
        };
      }
      throw new ConflictError('An account with this email address already exists. Please sign in.');
    }

    if (data.phoneNumber) {
      const existingByPhone = await userRepo.findByPhoneNumber(data.phoneNumber);
      if (existingByPhone) {
        if (existingByPhone.status === 'pending_verification' && existingByPhone.email === normalizedEmail) {
          logger.info('Signup by existing pending phone number, regenerating OTP', { email: normalizedEmail, userId: existingByPhone.id });
          const otp = await otpService.generateAndSave(normalizedEmail, 'registration');
          emailService.sendVerificationOTP(normalizedEmail, otp).catch((err: any) => {
            logger.warn('Asynchronous OTP email dispatch error', { error: err.message, email: normalizedEmail });
          });
          return {
            message: 'Account pending verification. A new verification OTP has been sent to your email.',
            userId: existingByPhone.id,
            email: normalizedEmail,
            requiresVerification: true
          };
        }
        throw new ConflictError('An account with this phone number is already registered. Please sign in or use a different phone number.');
      }
    }

    const passwordHash = await hashPassword(data.password);

    let newUser;
    try {
      newUser = await userRepo.create({
        email: normalizedEmail,
        passwordHash,
        fullName: data.fullName,
        department: data.department,
        graduationYear: data.graduationYear,
        phoneNumber: data.phoneNumber,
        role: 'student',
        status: 'pending_verification'
      });
      logger.info('Student user created in database as pending_verification', { userId: newUser.id, email: normalizedEmail });
    } catch (err: any) {
      if (err.code === '23505') {
        const errorDetail = `${err.constraint || ''} ${err.message || ''}`.toLowerCase();
        if (errorDetail.includes('phone')) {
          throw new ConflictError('An account with this phone number is already registered. Please sign in or use a different phone number.');
        }
        if (errorDetail.includes('email')) {
          throw new ConflictError('An account with this email address already exists. Please sign in.');
        }
      }
      throw err;
    }

    const otp = await otpService.generateAndSave(normalizedEmail, 'registration');
    emailService.sendVerificationOTP(normalizedEmail, otp).catch((err: any) => {
      logger.warn('Asynchronous OTP email dispatch error', { error: err.message, email: normalizedEmail });
    });

    return {
      message: 'Registration initiated successfully. Please verify your email with the 6-digit OTP sent to your university inbox.',
      userId: newUser.id,
      email: newUser.email,
      requiresVerification: true
    };
  },

  async verifyEmailOtp(email: string, otp: string, userAgent?: string, ipAddress?: string) {
    const normalizedEmail = email.toLowerCase().trim();
    logger.info('Verifying email OTP', { email: normalizedEmail });

    const user = await userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestError('User not found');
    }

    await otpService.verify(normalizedEmail, 'registration', otp);
    const updatedUser = await userRepo.markEmailVerified(user.id);
    logger.info('User marked email_verified and status set to active', { userId: updatedUser.id, email: normalizedEmail });

    // Create session and return tokens
    const tokenFamily = crypto.randomUUID();
    const accessToken = signAccessToken(updatedUser.id);
    const refreshToken = signRefreshToken(updatedUser.id, tokenFamily);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await sessionRepo.create({
      userId: updatedUser.id,
      tokenFamily,
      tokenHash: hashToken(refreshToken),
      userAgent,
      ipAddress,
      expiresAt
    });

    return {
      message: 'Email successfully verified. Welcome to Campus Radar!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        anonymousPseudonym: updatedUser.anonymous_pseudonym || `Anonymous #${String(updatedUser.anonymous_number || 1).padStart(2, '0')}`,
        anonymousNumber: updatedUser.anonymous_number,
        role: updatedUser.role,
        status: updatedUser.status,
        emailVerified: updatedUser.email_verified,
        department: updatedUser.department,
        graduationYear: updatedUser.graduation_year
      },
      tokens: {
        accessToken,
        refreshToken
      }
    };
  },

  async resendOtp(email: string, purpose: string = 'registration') {
    const normalizedEmail = email.toLowerCase().trim();
    logger.info('Resending OTP requested', { email: normalizedEmail, purpose });

    const user = await userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestError('Account does not exist');
    }

    const otp = await otpService.generateAndSave(normalizedEmail, purpose);
    emailService.sendVerificationOTP(normalizedEmail, otp).catch((err: any) => {
      logger.warn('Asynchronous OTP resend email dispatch error', { error: err.message, email: normalizedEmail });
    });

    return { message: 'A new verification code has been dispatched to your email.' };
  },

  async login(email: string, password: string, userAgent?: string, ipAddress?: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await userRepo.findByEmail(normalizedEmail);

    if (!user) {
      // Timing-safe: perform a dummy password verification to equalize response time
      // This prevents attackers from determining whether an email exists based on response latency
      await verifyPassword(password, DUMMY_HASH).catch(() => {});
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === 'banned') {
      throw new ForbiddenError('Your account has been permanently banned from Campus Radar.');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenError('Your account is temporarily suspended.');
    }
    if (user.status === 'pending_verification') {
      const otp = await otpService.generateAndSave(normalizedEmail, 'registration');
      await emailService.sendVerificationOTP(normalizedEmail, otp);
      return {
        requiresVerification: true,
        email: user.email,
        message: 'Account not verified. A verification code has been sent to your university email.'
      };
    }

    const tokenFamily = crypto.randomUUID();
    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id, tokenFamily);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await sessionRepo.create({
      userId: user.id,
      tokenFamily,
      tokenHash: hashToken(refreshToken),
      userAgent,
      ipAddress,
      expiresAt
    });

    // Enforce max 5 active sessions per user — revoke oldest if exceeded
    await sessionRepo.enforceMaxSessions(user.id, 5);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        anonymousPseudonym: user.anonymous_pseudonym || `Anonymous #${String(user.anonymous_number || 1).padStart(2, '0')}`,
        anonymousNumber: user.anonymous_number,
        role: user.role,
        status: user.status,
        emailVerified: user.email_verified,
        department: user.department,
        graduationYear: user.graduation_year
      },
      tokens: {
        accessToken,
        refreshToken
      }
    };
  },

  async refreshTokens(rawRefreshToken: string, userAgent?: string, ipAddress?: string) {
    try {
      verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const incomingHash = hashToken(rawRefreshToken);
    const session = await sessionRepo.findByTokenHash(incomingHash);

    if (!session) {
      throw new UnauthorizedError('Session not found or expired');
    }

    // TOKEN REUSE DETECTION:
    // If the token is already revoked, an attacker or compromised token might be trying to reuse it.
    // Invalidate the ENTIRE token family immediately!
    if (session.is_revoked) {
      logger.warn('Refresh token reuse detected! Revoking family.', {
        userId: session.user_id,
        family: session.token_family
      });
      await sessionRepo.revokeFamily(session.token_family);
      throw new UnauthorizedError('Session compromise detected. All active sessions in this family have been invalidated. Please log in again.');
    }

    // Verify user is still active in database
    const user = await userRepo.findById(session.user_id);
    if (!user || user.status !== 'active') {
      await sessionRepo.revokeFamily(session.token_family);
      throw new ForbiddenError('Account is no longer active');
    }

    // Revoke old token
    await sessionRepo.revokeToken(session.id);

    // Issue new rotated pair within the same token family
    const newAccessToken = signAccessToken(user.id);
    const newRefreshToken = signRefreshToken(user.id, session.token_family);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await sessionRepo.create({
      userId: user.id,
      tokenFamily: session.token_family,
      tokenHash: hashToken(newRefreshToken),
      userAgent,
      ipAddress,
      expiresAt
    });

    return {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    };
  },

  async logout(rawRefreshToken: string) {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    const session = await sessionRepo.findByTokenHash(tokenHash);
    if (session) {
      await sessionRepo.revokeFamily(session.token_family);
    }
  }
};
