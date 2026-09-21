import rateLimit from 'express-rate-limit';
import { env } from './env.js';

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many requests from this IP, please try again later.'
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10, // max 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 5, // max 5 OTP requests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many OTP requests. Please wait before requesting another code.'
  }
});

export const postCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 mins
  max: 10, // max 10 posts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Post creation limit reached. Please wait a few minutes.'
  }
});

export const adminAuthLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 mins
  max: 5, // max 5 admin login attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many admin login attempts. Please try again after 30 minutes.'
  }
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20, // max 20 refresh requests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many token refresh requests. Please try again later.'
  }
});

export const logoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many logout requests.'
  }
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20, // max 20 image uploads per 15 minutes per user/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Upload rate limit exceeded. Please wait before uploading more images.'
  }
});

