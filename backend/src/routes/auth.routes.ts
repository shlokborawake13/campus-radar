import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, otpLimiter, refreshLimiter, logoutLimiter } from '../config/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  refreshTokenSchema
} from '../validators/auth.schema.js';

const router = Router();

router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  authController.register
);

router.post(
  '/verify-otp',
  otpLimiter,
  validate({ body: verifyOtpSchema }),
  authController.verifyOtp
);

router.post(
  '/resend-otp',
  otpLimiter,
  validate({ body: resendOtpSchema }),
  authController.resendOtp
);

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  authController.login
);

router.post(
  '/refresh',
  refreshLimiter,
  validate({ body: refreshTokenSchema }),
  authController.refresh
);

router.post(
  '/logout',
  logoutLimiter,
  authController.logout
);

router.get(
  '/me',
  requireAuth,
  authController.me
);

export default router;
