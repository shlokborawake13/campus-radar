import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export function requireRole(allowedRoles: UserRole[], concealAsNotFound: boolean = false) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      if (concealAsNotFound) {
        return next(new NotFoundError('Cannot GET ' + req.originalUrl));
      }
      return next(new ForbiddenError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      if (concealAsNotFound) {
        // Obscure admin endpoints as standard 404 Not Found for unauthorized students
        return next(new NotFoundError('Cannot ' + req.method + ' ' + req.originalUrl));
      }
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    next();
  };
}

export const requireAdmin = requireRole(['admin', 'super_admin'], true);
export const requireModerator = requireRole(['moderator', 'admin', 'super_admin'], true);
export const requireSuperAdmin = requireRole(['super_admin'], true);
