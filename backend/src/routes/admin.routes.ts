import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireModerator, requireSuperAdmin } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { logAdminAction } from '../middleware/auditLog.js';
import { adminAuthLimiter } from '../config/rateLimit.js';
import {
  adminLoginSchema,
  verifyTotpSetupSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  resolveReportSchema,
  resolveModerationSchema
} from '../validators/admin.schema.js';

const router = Router();

// --- Non-authenticated Admin Auth Endpoints ---
router.post(
  '/auth/login',
  adminAuthLimiter,
  validate({ body: adminLoginSchema }),
  adminController.login
);

router.post(
  '/auth/confirm-mfa',
  adminAuthLimiter,
  validate({ body: verifyTotpSetupSchema }),
  adminController.confirmMfa
);

// --- Protected Admin & Moderator Endpoints ---
// Every protected endpoint enforces DB-based role authorization and returns 404 to non-admins!
router.use(requireAuth);

// Analytics & Metrics (Moderators and Admins)
router.get(
  '/stats',
  requireModerator,
  adminController.getStats
);

router.get(
  '/overview',
  requireModerator,
  adminController.getOverview
);

router.get(
  '/activity',
  requireModerator,
  adminController.getActivity
);

router.get(
  '/analytics',
  requireModerator,
  adminController.getAnalytics
);

// Content Management: Posts (Moderators can view, Admins can delete)
router.get(
  '/posts',
  requireModerator,
  adminController.listPosts
);

router.delete(
  '/posts/:id',
  requireAdmin,
  logAdminAction('DELETE_POST', 'post'),
  adminController.deletePost
);

// Content Management: Confessions
router.get(
  '/confessions',
  requireModerator,
  adminController.listConfessions
);

router.delete(
  '/confessions/:id',
  requireAdmin,
  logAdminAction('DELETE_CONFESSION', 'confession'),
  adminController.deleteConfession
);

// Event Management
router.get(
  '/events',
  requireModerator,
  adminController.listEvents
);

router.post(
  '/events',
  requireAdmin,
  logAdminAction('CREATE_EVENT', 'event'),
  adminController.createEvent
);

router.delete(
  '/events/:id',
  requireAdmin,
  logAdminAction('DELETE_EVENT', 'event'),
  adminController.deleteEvent
);

// Content Moderation Queue
router.get(
  '/moderation',
  requireModerator,
  adminController.listModerationQueue
);

router.post(
  '/moderation/:id/review',
  requireModerator,
  validate({ body: resolveModerationSchema }),
  logAdminAction('REVIEW_MODERATION_ITEM', 'moderation_queue'),
  adminController.reviewModeration
);

// Reports Queue
router.get(
  '/reports',
  requireModerator,
  adminController.listReports
);

router.post(
  '/reports/:id/resolve',
  requireModerator,
  validate({ body: resolveReportSchema }),
  logAdminAction('RESOLVE_REPORT', 'report'),
  adminController.resolveReport
);

// User Management (Admins Only)
router.get(
  '/users',
  requireAdmin,
  adminController.listUsers
);

router.patch(
  '/users/:id/status',
  requireAdmin,
  validate({ body: updateUserStatusSchema }),
  logAdminAction('UPDATE_USER_STATUS', 'user'),
  adminController.updateUserStatus
);

router.patch(
  '/users/:id/role',
  requireSuperAdmin,
  validate({ body: updateUserRoleSchema }),
  logAdminAction('UPDATE_USER_ROLE', 'user'),
  adminController.updateUserRole
);

// Audit Logs (Admins Only)
router.get(
  '/audit-logs',
  requireAdmin,
  adminController.listAuditLogs
);

export default router;
