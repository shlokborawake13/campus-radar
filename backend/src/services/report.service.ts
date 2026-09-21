import { query } from '../config/database.js';
import { ReportTargetType } from '../types/index.js';

export const reportService = {
  async submitReport(
    reporterId: string,
    data: {
      targetType: ReportTargetType;
      targetId: string;
      reason: string;
      details?: string;
    }
  ) {
    const res = await query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, target_type, target_id, reason, status, created_at`,
      [reporterId, data.targetType, data.targetId, data.reason, data.details || null]
    );

    // Auto-flagging logic: If 3 or more distinct users report the same item, flag it for review
    const countRes = await query(
      `SELECT COUNT(DISTINCT reporter_id) as count 
       FROM reports 
       WHERE target_type = $1 AND target_id = $2`,
      [data.targetType, data.targetId]
    );

    const distinctCount = parseInt(countRes.rows[0].count, 10);
    if (distinctCount >= 3) {
      if (data.targetType === 'post') {
        await query("UPDATE posts SET status = 'flagged' WHERE id = $1", [data.targetId]);
      } else if (data.targetType === 'confession') {
        await query("UPDATE confessions SET status = 'flagged' WHERE id = $1", [data.targetId]);
      }
    }

    return res.rows[0];
  }
};
