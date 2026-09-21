import { query } from '../config/database.js';
import { contentFilter } from './contentFilter.js';
import { uploadService } from './upload.service.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { PaginatedResult } from '../types/index.js';

export const postService = {
  async createPost(userId: string, data: { content: string; tag?: string; imageUrl?: string | null }) {
    // If an image URL is attached, strictly validate the user's verification state & storage authenticity
    if (data.imageUrl) {
      const userCheck = await query('SELECT email_verified, status FROM users WHERE id = $1', [userId]);
      if (userCheck.rowCount === 0 || !userCheck.rows[0].email_verified || userCheck.rows[0].status !== 'active') {
        throw new ForbiddenError('Your account must be verified before you can attach images to posts.');
      }
      await uploadService.validateAndAttachImage(userId, data.imageUrl, 'post');
    }

    const modCheck = contentFilter.checkContent(data.content);
    const initialStatus = modCheck.isFlagged ? 'flagged' : 'active';

    const res = await query(
      `INSERT INTO posts (author_id, content, tag, image_url, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content, tag, image_url, status, likes_count, comments_count, created_at`,
      [userId, data.content, data.tag || 'general', data.imageUrl || null, initialStatus]
    );

    const post = res.rows[0];

    // Mark upload record with the newly created post ID
    if (data.imageUrl) {
      await uploadService.validateAndAttachImage(userId, data.imageUrl, 'post', post.id);
    }

    // Fetch author's consistent anonymous pseudonym without exposing author_id
    const userRes = await query(
      `SELECT COALESCE(anonymous_pseudonym, 'Anonymous #' || LPAD(anonymous_number::text, 2, '0')) as pseudonym 
       FROM users WHERE id = $1`,
      [userId]
    );
    const authorName = userRes.rows[0]?.pseudonym || 'Anonymous Student';

    if (modCheck.isFlagged && modCheck.reason) {
      await contentFilter.recordFlaggedContent('post', post.id, modCheck.reason);
    }

    return {
      ...post,
      author_name: authorName,
      is_owner: true,
      is_liked: false,
      is_saved: false
    };
  },

  async getFeed(currentUserId: string, cursor?: string, limit: number = 15, tag?: string): Promise<PaginatedResult<any>> {
    const params: any[] = [currentUserId, limit + 1];
    let whereClause = `p.deleted_at IS NULL AND p.status = 'active'`;

    if (tag && tag !== 'all') {
      params.push(tag);
      whereClause += ` AND p.tag = $${params.length}`;
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        params.push(decoded.createdAt, decoded.id);
        whereClause += ` AND (p.created_at, p.id) < ($${params.length - 1}, $${params.length})`;
      }
    }

    // PRIVACY ENFORCEMENT: Never expose author_id, full_name, avatar_url, or department in student-facing queries!
    const sql = `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.tag,
        p.likes_count,
        p.comments_count,
        p.created_at,
        p.updated_at,
        COALESCE(u.anonymous_pseudonym, 'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')) as author_name,
        CASE WHEN p.author_id = $1 THEN TRUE ELSE FALSE END as is_owner,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked,
        CASE WHEN sp.id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = $1
      LEFT JOIN saved_posts sp ON sp.post_id = p.id AND sp.user_id = $1
      WHERE ${whereClause}
      ORDER BY p.created_at DESC, p.id DESC
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

  async getPostById(postId: string, currentUserId: string) {
    // PRIVACY ENFORCEMENT: Exclude author_id and full_name
    const res = await query(
      `SELECT 
        p.id,
        p.content,
        p.image_url,
        p.tag,
        p.likes_count,
        p.comments_count,
        p.created_at,
        p.updated_at,
        COALESCE(u.anonymous_pseudonym, 'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')) as author_name,
        CASE WHEN p.author_id = $2 THEN TRUE ELSE FALSE END as is_owner,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked,
        CASE WHEN sp.id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved
       FROM posts p
       JOIN users u ON p.author_id = u.id
       LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = $2
       LEFT JOIN saved_posts sp ON sp.post_id = p.id AND sp.user_id = $2
       WHERE p.id = $1 AND p.deleted_at IS NULL AND p.status = 'active'`,
      [postId, currentUserId]
    );

    if (res.rowCount === 0) {
      throw new NotFoundError('Post not found');
    }

    return res.rows[0];
  },

  async deletePost(postId: string, requestingUserId: string, requestingUserRole: string) {
    const postRes = await query('SELECT id, author_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
    if (postRes.rowCount === 0) {
      throw new NotFoundError('Post not found');
    }

    const post = postRes.rows[0];
    const isOwner = post.author_id === requestingUserId;
    const isPrivileged = ['moderator', 'admin', 'super_admin'].includes(requestingUserRole);

    if (!isOwner && !isPrivileged) {
      throw new ForbiddenError('You can only delete your own posts');
    }

    // Soft deletion
    await query('UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [postId]);
    await query('UPDATE uploads SET is_attached = FALSE WHERE attached_to_id = $1', [postId]);
    return { success: true, message: 'Post successfully deleted' };
  },

  async getTrendingPosts(currentUserId: string) {
    // Server-calculated trending algorithm based on engagement and recency - anonymous projection
    const res = await query(
      `SELECT 
        p.id,
        p.content,
        p.image_url,
        p.tag,
        p.likes_count,
        p.comments_count,
        p.created_at,
        COALESCE(u.anonymous_pseudonym, 'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')) as author_name,
        CASE WHEN p.author_id = $1 THEN TRUE ELSE FALSE END as is_owner,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked,
        CASE WHEN sp.id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved,
        ((p.likes_count * 2 + p.comments_count * 3) / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600 + 2, 1.2)) as trending_score
       FROM posts p
       JOIN users u ON p.author_id = u.id
       LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = $1
       LEFT JOIN saved_posts sp ON sp.post_id = p.id AND sp.user_id = $1
       WHERE p.deleted_at IS NULL AND p.status = 'active' AND p.created_at > (NOW() - INTERVAL '7 days')
       ORDER BY trending_score DESC
       LIMIT 10`,
      [currentUserId]
    );

    return res.rows;
  }
};
