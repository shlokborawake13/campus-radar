import { z } from 'zod';
import { isAllowedStudentEmail } from '../security/emailDomain.js';

export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .refine((email) => isAllowedStudentEmail(email), {
      message: 'Registration is restricted strictly to @sanjivani.edu.in email addresses'
    }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  department: z.string().max(100).optional(),
  graduationYear: z.number().int().min(2020).max(2035).optional(),
  // Phone number is required — student cannot create account without it
  phoneNumber: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number is too long')
    .regex(/^\+?[0-9\s-]{10,15}$/, 'Please enter a valid phone number')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  purpose: z.enum(['registration', 'login_verification', 'password_reset']).default('registration')
});

export const resendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  purpose: z.enum(['registration', 'login_verification', 'password_reset']).default('registration')
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});
