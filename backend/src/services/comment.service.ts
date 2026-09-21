import { query, withTransaction } from '../config/database.js';
import { generateAnonymousPseudonym } from './pseudonym.js';
import { contentFilter } from './contentFilter.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export const commentService = {
  async addComment(
    userId: string,
    data: {
      content: string;
      postId?: string;
      confessionId?: string;
      isAnonymous?: boolean;
    }
  ) {
    return await withTransaction(async (client) => {
      // Validate parent exists
      if (data.postId) {
        const postRes = await client.query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL', [data.postId]);
        if (postRes.rowCount === 0) throw new NotFoundError('Target post not found');
      } else if (data.confessionId) {
        const confRes = await client.query('SELECT id FROM confessions WHERE id = $1 AND deleted_at IS NULL', [data.confessionId]);
        if (confRes.rowCount === 0) throw new NotFoundError('Target confession not found');
      }

      // Fetch user's consistent anonymous pseudonym
      const userRes = await client.query(
        `SELECT COALESCE(anonymous_pseudonym, 'Anonymous #' || LPAD(anonymous_number::text, 2, '0')) as pseudonym 
         FROM users WHERE id = $1`,
        [userId]
      );
      // For confessions, use random pseudonym to maximize protection; for posts use user's anonymous pseudonym
      const pseudonym = data.confessionId 
        ? generateAnonymousPseudonym() 
        : (userRes.rows[0]?.pseudonym || generateAnonymousPseudonym());

      // Insert comment - strictly anonymous
      const insertRes = await client.query(
        `INSERT INTO comments (author_id, post_id, confession_id, content, is_anonymous, anonymous_pseudonym)
         VALUES ($1, $2, $3, $4, TRUE, $5)
         RETURNING id, post_id, confession_id, content, anonymous_pseudonym, created_at`,
        [userId, data.postId || null, data.confessionId || null, data.content, pseudonym]
      );
      const comment = insertRes.rows[0];

      // Atomically update parent comment count
      if (data.postId) {
        await client.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [data.postId]);
      } else if (data.confessionId) {
        await client.query('UPDATE confessions SET comments_count = comments_count + 1 WHERE id = $1', [data.confessionId]);
      }

      // Record mod flag if necessary
      const modCheck = contentFilter.checkContent(data.content);
      if (modCheck.isFlagged && modCheck.reason) {
        await contentFilter.recordFlaggedContent('comment', comment.id, modCheck.reason);
      }

      return {
        id: comment.id,
        content: comment.content,
        author_name: pseudonym,
        created_at: comment.created_at,
        is_owner: true
      };
    });
  },

  async getComments(targetType: 'post' | 'confession', targetId: string) {
    const isPost = targetType === 'post';
    const condition = isPost ? 'c.post_id = $1' : 'c.confession_id = $1';

    // PRIVACY ENFORCEMENT: Never select c.author_id or u.full_name!
    const sql = `
      SELECT 
        c.id,
        c.content,
        c.created_at,
        COALESCE(
          c.anonymous_pseudonym,
          u.anonymous_pseudonym,
          'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')
        ) as author_name
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE ${condition} AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `;

    const res = await query(sql, [targetId]);
    return res.rows;
  },

  async deleteComment(commentId: string, requestingUserId: string, requestingUserRole: string) {
    return await withTransaction(async (client) => {
      const res = await client.query('SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL', [commentId]);
      if (res.rowCount === 0) throw new NotFoundError('Comment not found');

      const comment = res.rows[0];
      const isOwner = comment.author_id === requestingUserId;
      const isPrivileged = ['moderator', 'admin', 'super_admin'].includes(requestingUserRole);

      if (!isOwner && !isPrivileged) {
        throw new ForbiddenError('You can only delete your own comments');
      }

      await client.query('UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [commentId]);

      if (comment.post_id) {
        await client.query('UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1', [comment.post_id]);
      } else if (comment.confession_id) {
        await client.query('UPDATE confessions SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1', [comment.confession_id]);
      }

      return { success: true, message: 'Comment removed' };
    });
  }
};
