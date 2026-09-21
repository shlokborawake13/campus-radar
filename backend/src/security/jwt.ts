import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

const JWT_ISSUER = 'campus-radar';
const JWT_AUDIENCE = 'campus-radar-api';

export interface TokenPayload {
  sub: string; // userId
  type: 'access' | 'refresh';
  family?: string; // refresh token family UUID
  jti?: string;
}

export function signAccessToken(userId: string): string {
  const payload: TokenPayload = {
    sub: userId,
    type: 'access',
    jti: crypto.randomUUID()
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

export function signRefreshToken(userId: string, familyId: string): string {
  const payload: TokenPayload = {
    sub: userId,
    type: 'refresh',
    family: familyId,
    jti: crypto.randomUUID()
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  }) as TokenPayload;
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  }) as TokenPayload;
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

