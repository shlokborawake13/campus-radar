import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { verifyAccessToken } from '../security/jwt.js';
import { query } from '../config/database.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);

    // CRITICAL SECURITY REQUIREMENT: Role and active status are ALWAYS fetched fresh from the database,
    // NEVER taken from the JWT payload.
    const userRes = await query(
      `SELECT id, email, role, status, full_name, department, graduation_year, anonymous_pseudonym, anonymous_number 
       FROM users 
       WHERE id = $1`,
      [payload.sub]
    );

    if (userRes.rowCount === 0) {
      return next(new UnauthorizedError('User does not exist or has been deleted'));
    }

    const user = userRes.rows[0];

    // Check account status
    if (user.status === 'banned') {
      return next(new ForbiddenError('Your account has been permanently banned'));
    }
    if (user.status === 'suspended') {
      return next(new ForbiddenError('Your account is currently suspended'));
    }
    if (user.status === 'pending_verification') {
      return next(new ForbiddenError('Please verify your university email before accessing this resource'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      fullName: user.full_name,
      anonymousPseudonym: user.anonymous_pseudonym || `Anonymous #${String(user.anonymous_number || 1).padStart(2, '0')}`,
      anonymousNumber: user.anonymous_number,
      department: user.department,
      graduationYear: user.graduation_year
    };

    next();
  } catch (err: any) {
    return next(new UnauthorizedError('Invalid or expired access token'));
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    const userRes = await query(
      `SELECT id, email, role, status, full_name, department, graduation_year 
       FROM users 
       WHERE id = $1`,
      [payload.sub]
    );

    if (userRes.rowCount && userRes.rows[0].status === 'active') {
      const user = userRes.rows[0];
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        fullName: user.full_name,
        department: user.department,
        graduationYear: user.graduation_year
      };
    }
  } catch {
    // Optional auth silently ignores invalid tokens
  }
  next();
}
