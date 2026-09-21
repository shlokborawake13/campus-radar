import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export const profileService = {
  async getProfile(targetUserId: string, currentUserId: string) {
    const isSelf = targetUserId === currentUserId || targetUserId === 'me';
    const effectiveUserId = isSelf ? currentUserId : targetUserId;

    if (!isSelf) {
      // PRIVACY ENFORCEMENT: Never expose another student's real name, email, or internal details
      const publicUserRes = await query(
        `SELECT 
          COALESCE(anonymous_pseudonym, 'Anonymous #' || LPAD(anonymous_number::text, 2, '0')) as anonymous_pseudonym,
          reputation_score,
          created_at
         FROM users 
         WHERE id = $1`,
        [effectiveUserId]
      );

      if (publicUserRes.rowCount === 0) {
        throw new NotFoundError('User profile not found');
      }

      return {
        profile: publicUserRes.rows[0],
        recentPosts: [],
        isSelf: false
      };
    }

    const userRes = await query(
      `SELECT 
        id, 
        full_name, 
        email,
        phone_number,
        avatar_url, 
        bio, 
        department, 
        graduation_year, 
        role,
        status,
        COALESCE(anonymous_pseudonym, 'Anonymous #' || LPAD(anonymous_number::text, 2, '0')) as anonymous_pseudonym,
        anonymous_number,
        reputation_score,
        created_at
       FROM users 
       WHERE id = $1`,
      [currentUserId]
    );

    if (userRes.rowCount === 0) {
      throw new NotFoundError('User profile not found');
    }

    const user = userRes.rows[0];

    // Fetch user's own active posts without leaking real name
    const postsRes = await query(
      `SELECT 
        id, content, tag, image_url, likes_count, comments_count, created_at,
        $2 as author_name,
        TRUE as is_owner
       FROM posts
       WHERE author_id = $1 AND deleted_at IS NULL AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 10`,
      [currentUserId, user.anonymous_pseudonym]
    );

    return {
      profile: user,
      recentPosts: postsRes.rows,
      isSelf: true
    };
  },

  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      bio?: string;
      department?: string;
      graduationYear?: number;
      avatarUrl?: string | null;
    }
  ) {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.fullName !== undefined) {
      values.push(data.fullName);
      updates.push(`full_name = $${values.length}`);
    }
    if (data.bio !== undefined) {
      values.push(data.bio);
      updates.push(`bio = $${values.length}`);
    }
    if (data.department !== undefined) {
      values.push(data.department);
      updates.push(`department = $${values.length}`);
    }
    if (data.graduationYear !== undefined) {
      values.push(data.graduationYear);
      updates.push(`graduation_year = $${values.length}`);
    }
    if (data.avatarUrl !== undefined) {
      values.push(data.avatarUrl);
      updates.push(`avatar_url = $${values.length}`);
    }

    if (updates.length === 0) {
      return this.getProfile(userId, userId);
    }

    values.push(userId);
    const sql = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, full_name, email, department, graduation_year, bio, avatar_url, reputation_score
    `;

    const res = await query(sql, values);
    return res.rows[0];
  }
};
