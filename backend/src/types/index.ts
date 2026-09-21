import { Request } from 'express';

export type UserRole = 'student' | 'moderator' | 'admin' | 'super_admin';
export type UserStatus = 'pending_verification' | 'active' | 'suspended' | 'banned';
export type VerificationMethod = 'email_otp' | 'sms_otp' | 'admin_override';
export type PostStatus = 'active' | 'under_review' | 'removed' | 'flagged';
export type EventCategory = 'hackathon' | 'cultural' | 'workshop' | 'sports' | 'seminar' | 'general';
export type ReportTargetType = 'post' | 'confession' | 'comment' | 'user';
export type ReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  anonymousPseudonym?: string;
  anonymousNumber?: number;
  department: string | null;
  graduationYear: number | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  tokenFamily?: string;
  sessionId?: string;
}

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
