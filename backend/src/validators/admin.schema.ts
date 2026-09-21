import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional()
});

export const verifyTotpSetupSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits')
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned', 'pending_verification']),
  reason: z.string().min(3).max(500)
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['student', 'moderator', 'admin']),
  reason: z.string().min(3).max(500)
});

export const resolveReportSchema = z.object({
  status: z.enum(['reviewed', 'action_taken', 'dismissed']),
  actionNotes: z.string().max(1000).optional(),
  actionToTake: z.enum(['none', 'remove_content', 'ban_user', 'suspend_user']).optional()
});

export const resolveModerationSchema = z.object({
  status: z.enum(['approved', 'rejected', 'escalated']),
  reviewNotes: z.string().max(1000).optional()
});
