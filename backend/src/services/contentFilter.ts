import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Sensitive / prohibited patterns list for auto-moderation
const BANNED_PATTERNS = [
  /\bhate\s+speech\b/i,
  /\bkill\s+yourself\b/i,
  /\bleak(ed)?\s+paper\b/i,
  /\bcheating\s+exam\b/i,
  /\bracist\b/i
];

export interface ModerationCheckResult {
  isFlagged: boolean;
  reason?: string;
}

export const contentFilter = {
  checkContent(text: string): ModerationCheckResult {
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(text)) {
        return {
          isFlagged: true,
          reason: `Violates campus code of conduct: pattern ${pattern.source}`
        };
      }
    }
    return { isFlagged: false };
  },

  async recordFlaggedContent(
    contentType: 'post' | 'confession' | 'comment',
    contentId: string,
    reason: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO moderation_queue (content_type, content_id, flagged_reason, status)
         VALUES ($1, $2, $3, 'auto_flagged')`,
        [contentType, contentId, reason]
      );
    } catch (err: any) {
      logger.error('Failed to log auto-flagged moderation item', { error: err.message });
    }
  }
};
