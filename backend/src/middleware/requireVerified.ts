import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { query } from '../config/database.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Middleware: requireVerifiedUser
 * Strict server-side verification check.
 * Checks the database in real-time to ensure the authenticated user has:
 *  - email_verified = true
 *  - status = 'active'
 *
 * Never trusts frontend flags or stale token claims.
 */
export async function requireVerifiedUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.user.id) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const userRes = await query(
      `SELECT id, email, role, status, email_verified, phone_verified 
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );

    if (userRes.rowCount === 0) {
      return next(new UnauthorizedError('User account not found'));
    }

    const user = userRes.rows[0];

    // Status check
    if (user.status !== 'active') {
      return next(new ForbiddenError('Your account must be active and in good standing to perform this action'));
    }

    // Strict email verification check
    if (!user.email_verified) {
      return next(new ForbiddenError('Your account must be verified before you can upload images.'));
    }

    next();
  } catch (err: any) {
    next(err);
  }
}
