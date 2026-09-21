import { query } from '../config/database.js';
import { generateAnonymousPseudonym } from './pseudonym.js';
import { contentFilter } from './contentFilter.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';
import { NotFoundError } from '../utils/errors.js';
import { PaginatedResult } from '../types/index.js';

export const confessionService = {
  async createConfession(userId: string, data: { content: string; category?: string }) {
    const pseudonym = generateAnonymousPseudonym();
    const modCheck = contentFilter.checkContent(data.content);
    const initialStatus = modCheck.isFlagged ? 'flagged' : 'active';

    const res = await query(
      `INSERT INTO confessions (author_id, anonymous_pseudonym, content, category, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, anonymous_pseudonym, content, category, likes_count, comments_count, created_at`,
      [userId, pseudonym, data.content, data.category || 'campus-life', initialStatus]
    );

    const confession = res.rows[0];

    if (modCheck.isFlagged && modCheck.reason) {
      await contentFilter.recordFlaggedContent('confession', confession.id, modCheck.reason);
    }

    return confession;
  },

  async getConfessions(currentUserId: string, cursor?: string, limit: number = 20, category?: string): Promise<PaginatedResult<any>> {
    const params: any[] = [currentUserId, limit + 1];
    let whereClause = `c.deleted_at IS NULL AND c.status = 'active'`;

    if (category && category !== 'all') {
      params.push(category);
      whereClause += ` AND c.category = $${params.length}`;
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        params.push(decoded.createdAt, decoded.id);
        whereClause += ` AND (c.created_at, c.id) < ($${params.length - 1}, $${params.length})`;
      }
    }

    // PRIVACY ENFORCEMENT: Never select c.author_id in student-facing queries!
    const sql = `
      SELECT 
        c.id,
        c.anonymous_pseudonym,
        c.content,
        c.category,
        c.likes_count,
        c.comments_count,
        c.created_at,
        CASE WHEN cl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked
      FROM confessions c
      LEFT JOIN confession_likes cl ON cl.confession_id = c.id AND cl.user_id = $1
      WHERE ${whereClause}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $2
    `;

    const res = await query(sql, params);
    const hasMore = res.rows.length > limit;
    const items = hasMore ? res.rows.slice(0, limit) : res.rows;

    let nextCursor: string | null = null;
    if (items.length > 0 && hasMore) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor(new Date(last.created_at), last.id);
    }

    return {
      data: items,
      nextCursor,
      hasMore
    };
  },

  async getConfessionById(confessionId: string, currentUserId: string) {
    const res = await query(
      `SELECT 
        c.id,
        c.anonymous_pseudonym,
        c.content,
        c.category,
        c.likes_count,
        c.comments_count,
        c.created_at,
        CASE WHEN cl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked
       FROM confessions c
       LEFT JOIN confession_likes cl ON cl.confession_id = c.id AND cl.user_id = $2
       WHERE c.id = $1 AND c.deleted_at IS NULL AND c.status = 'active'`,
      [confessionId, currentUserId]
    );

    if (res.rowCount === 0) {
      throw new NotFoundError('Confession not found');
    }

    return res.rows[0];
  }
};
