import { query, withTransaction } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export const likeService = {
  async togglePostLike(userId: string, postId: string): Promise<{ liked: boolean; count: number }> {
    return await withTransaction(async (client) => {
      // Check post exists
      const postCheck = await client.query('SELECT id, likes_count FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
      if (postCheck.rowCount === 0) throw new NotFoundError('Post not found');

      // Check if already liked
      const existing = await client.query('SELECT id FROM post_likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);

      if (existing.rowCount && existing.rowCount > 0) {
        // Unlike
        await client.query('DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        const updated = await client.query(
          'UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count',
          [postId]
        );
        return { liked: false, count: updated.rows[0].likes_count };
      } else {
        // Like (UNIQUE constraint guarantees idempotency against race conditions)
        await client.query(
          'INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT (user_id, post_id) DO NOTHING',
          [userId, postId]
        );
        const updated = await client.query(
          'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count',
          [postId]
        );
        return { liked: true, count: updated.rows[0].likes_count };
      }
    });
  },

  async toggleConfessionLike(userId: string, confessionId: string): Promise<{ liked: boolean; count: number }> {
    return await withTransaction(async (client) => {
      const confCheck = await client.query('SELECT id, likes_count FROM confessions WHERE id = $1 AND deleted_at IS NULL', [confessionId]);
      if (confCheck.rowCount === 0) throw new NotFoundError('Confession not found');

      const existing = await client.query('SELECT id FROM confession_likes WHERE user_id = $1 AND confession_id = $2', [userId, confessionId]);

      if (existing.rowCount && existing.rowCount > 0) {
        await client.query('DELETE FROM confession_likes WHERE user_id = $1 AND confession_id = $2', [userId, confessionId]);
        const updated = await client.query(
          'UPDATE confessions SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count',
          [confessionId]
        );
        return { liked: false, count: updated.rows[0].likes_count };
      } else {
        await client.query(
          'INSERT INTO confession_likes (user_id, confession_id) VALUES ($1, $2) ON CONFLICT (user_id, confession_id) DO NOTHING',
          [userId, confessionId]
        );
        const updated = await client.query(
          'UPDATE confessions SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count',
          [confessionId]
        );
        return { liked: true, count: updated.rows[0].likes_count };
      }
    });
  },

  async toggleSavePost(userId: string, postId: string): Promise<{ saved: boolean }> {
    const postCheck = await query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
    if (postCheck.rowCount === 0) throw new NotFoundError('Post not found');

    const existing = await query('SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);

    if (existing.rowCount && existing.rowCount > 0) {
      await query('DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
      return { saved: false };
    } else {
      await query(
        'INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT (user_id, post_id) DO NOTHING',
        [userId, postId]
      );
      return { saved: true };
    }
  },

  async getSavedPosts(userId: string) {
    // PRIVACY ENFORCEMENT: Never expose author_id, full_name, avatar_url, or department in saved posts!
    const sql = `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.tag,
        p.likes_count,
        p.comments_count,
        p.created_at,
        COALESCE(u.anonymous_pseudonym, 'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')) as author_name,
        CASE WHEN p.author_id = $1 THEN TRUE ELSE FALSE END as is_owner,
        TRUE as is_saved,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked
      FROM saved_posts sp
      JOIN posts p ON sp.post_id = p.id
      JOIN users u ON p.author_id = u.id
      LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = $1
      WHERE sp.user_id = $1 AND p.deleted_at IS NULL AND p.status = 'active'
      ORDER BY sp.created_at DESC
    `;
    const res = await query(sql, [userId]);
    return res.rows;
  }
};
