import crypto from 'crypto';
import { query, withTransaction } from '../config/database.js';
import { userRepo } from '../repositories/user.repo.js';
import { sessionRepo } from '../repositories/session.repo.js';
import { verifyPassword } from '../security/password.js';
import { signAccessToken, signRefreshToken, hashToken } from '../security/jwt.js';
import { generateTOTPSecret, generateTOTPQRCode, verifyTOTPToken } from '../security/totp.js';
import { NotFoundError, UnauthorizedError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { UserRole, UserStatus } from '../types/index.js';

export const adminService = {
  async adminLogin(email: string, password: string, totpCode?: string, userAgent?: string, ipAddress?: string) {
    const normEmail = email.toLowerCase().trim();
    const user = await userRepo.findByEmail(normEmail);

    if (!user || !['moderator', 'admin', 'super_admin'].includes(user.role)) {
      // Conceal admin login failure as generic unauthorized
      throw new UnauthorizedError('Invalid administrative credentials');
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid administrative credentials');
    }

    if (user.status !== 'active') {
      throw new ForbiddenError('Administrative account is disabled');
    }

    // Check TOTP MFA
    if (user.totp_enabled) {
      if (!totpCode) {
        return {
          requiresMfa: true,
          userId: user.id,
          message: 'TOTP MFA verification required'
        };
      }

      const isValidTotp = verifyTOTPToken(totpCode, user.totp_secret!, user.email);
      if (!isValidTotp) {
        throw new UnauthorizedError('Invalid or expired TOTP verification code');
      }
    } else {
      // Prompt admin to configure MFA
      const secret = user.totp_secret || generateTOTPSecret();
      if (!user.totp_secret) {
        await userRepo.updateTotpSecret(user.id, secret, false);
      }
      const qrCode = await generateTOTPQRCode(user.email, secret);
      return {
        setupMfaRequired: true,
        userId: user.id,
        qrCode,
        secret,
        message: 'MFA setup is required for administrative accounts'
      };
    }

    const tokenFamily = crypto.randomUUID();
    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id, tokenFamily);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await sessionRepo.create({
      userId: user.id,
      tokenFamily,
      tokenHash: hashToken(refreshToken),
      userAgent,
      ipAddress,
      expiresAt
    });

    return {
      message: 'Admin authentication successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken
      }
    };
  },

  async confirmMfaSetup(userId: string, totpCode: string) {
    const user = await userRepo.findById(userId);
    if (!user || !user.totp_secret) {
      throw new BadRequestError('No MFA setup in progress');
    }

    const isValid = verifyTOTPToken(totpCode, user.totp_secret, user.email);
    if (!isValid) {
      throw new BadRequestError('Invalid TOTP verification code. Please check your authenticator app.');
    }

    await userRepo.updateTotpSecret(userId, user.totp_secret, true);
    return { success: true, message: 'TOTP MFA successfully enabled on admin account' };
  },

  async getPlatformStats() {
    return this.getDashboardOverview();
  },

  async getDashboardOverview() {
    const [
      totalStudentsRes,
      studentsThisWeekRes,
      activeTodayRes,
      activeYesterdayRes,
      totalPostsRes,
      postsTodayRes,
      totalConfessionsRes,
      confessionsTodayRes,
      totalEventsRes,
      pendingReportsRes,
      reviewedReportsRes,
      weeklyChartRes
    ] = await Promise.all([
      query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status != 'banned'"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND created_at >= DATE_TRUNC('week', CURRENT_TIMESTAMP)"),
      query("SELECT COUNT(DISTINCT user_id) as count FROM refresh_sessions WHERE (updated_at >= CURRENT_DATE OR created_at >= CURRENT_DATE) AND is_revoked = FALSE"),
      query("SELECT COUNT(DISTINCT user_id) as count FROM refresh_sessions WHERE updated_at >= CURRENT_DATE - INTERVAL '1 day' AND updated_at < CURRENT_DATE AND is_revoked = FALSE"),
      query("SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NULL AND status = 'active'"),
      query("SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NULL AND status = 'active' AND created_at >= CURRENT_DATE"),
      query("SELECT COUNT(*) as count FROM confessions WHERE deleted_at IS NULL AND status = 'active'"),
      query("SELECT COUNT(*) as count FROM confessions WHERE deleted_at IS NULL AND status = 'active' AND created_at >= CURRENT_DATE"),
      query("SELECT COUNT(*) as count FROM events WHERE deleted_at IS NULL AND status = 'active'"),
      query("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'"),
      query("SELECT COUNT(*) as count FROM reports WHERE status = 'reviewed' OR status = 'action_taken'"),
      query(`
        WITH days AS (
          SELECT generate_series(
            DATE_TRUNC('day', CURRENT_TIMESTAMP) - INTERVAL '6 days',
            DATE_TRUNC('day', CURRENT_TIMESTAMP),
            INTERVAL '1 day'
          )::date AS day
        )
        SELECT 
          TO_CHAR(d.day, 'Dy') AS label,
          TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
          COALESCE(p.count, 0)::int AS posts,
          COALESCE(c.count, 0)::int AS confessions,
          COALESCE(u.count, 0)::int AS users
        FROM days d
        LEFT JOIN (
          SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS count
          FROM posts
          WHERE deleted_at IS NULL AND status = 'active'
          GROUP BY 1
        ) p ON d.day = p.day
        LEFT JOIN (
          SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS count
          FROM confessions
          WHERE deleted_at IS NULL AND status = 'active'
          GROUP BY 1
        ) c ON d.day = c.day
        LEFT JOIN (
          SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS count
          FROM users
          WHERE status != 'banned'
          GROUP BY 1
        ) u ON d.day = u.day
        ORDER BY d.day ASC
      `)
    ]);

    const totalStudents = parseInt(totalStudentsRes.rows[0]?.count || '0', 10);
    const studentsThisWeek = parseInt(studentsThisWeekRes.rows[0]?.count || '0', 10);
    const activeToday = parseInt(activeTodayRes.rows[0]?.count || '0', 10);
    const activeYesterday = parseInt(activeYesterdayRes.rows[0]?.count || '0', 10);
    const totalPosts = parseInt(totalPostsRes.rows[0]?.count || '0', 10);
    const postsToday = parseInt(postsTodayRes.rows[0]?.count || '0', 10);
    const totalConfessions = parseInt(totalConfessionsRes.rows[0]?.count || '0', 10);
    const confessionsToday = parseInt(confessionsTodayRes.rows[0]?.count || '0', 10);
    const totalEvents = parseInt(totalEventsRes.rows[0]?.count || '0', 10);
    const pendingReports = parseInt(pendingReportsRes.rows[0]?.count || '0', 10);
    const reviewedReports = parseInt(reviewedReportsRes.rows[0]?.count || '0', 10);

    let dauChange = 'No previous-period data';
    if (activeYesterday > 0) {
      const diff = activeToday - activeYesterday;
      const pct = Math.round((diff / activeYesterday) * 100);
      dauChange = `${diff >= 0 ? '+' : ''}${pct}% from yesterday`;
    } else if (activeToday > 0) {
      dauChange = `+${activeToday} today`;
    }

    return {
      totalStudents,
      studentsThisWeek,
      registrationsThisWeek: studentsThisWeek,
      activeToday,
      dailyActiveUsers: activeToday,
      dauChange,
      totalPosts,
      postsToday,
      totalConfessions,
      confessionsToday,
      totalEvents,
      pendingReports,
      reportsThisWeek: pendingReports,
      reviewedReports,
      weeklyChart: weeklyChartRes.rows
    };
  },

  async getRecentActivity(limit: number = 10) {
    const res = await query(
      `
      SELECT * FROM (
        SELECT 
          p.id::text as id,
          'post' as type,
          u.full_name as author_real_name,
          u.email as author_email,
          COALESCE(u.anonymous_pseudonym, 'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')) as actor_name,
          COALESCE(u.anonymous_number, 0) as anon_id,
          'created a post' as action_text,
          p.created_at
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.deleted_at IS NULL AND p.status = 'active'
        
        UNION ALL
        
        SELECT 
          c.id::text as id,
          'confession' as type,
          u.full_name as author_real_name,
          u.email as author_email,
          c.anonymous_pseudonym as actor_name,
          COALESCE(u.anonymous_number, 0) as anon_id,
          'submitted a confession' as action_text,
          c.created_at
        FROM confessions c
        JOIN users u ON c.author_id = u.id
        WHERE c.deleted_at IS NULL AND c.status = 'active'

        UNION ALL

        SELECT 
          e.id::text as id,
          'event' as type,
          u.full_name as author_real_name,
          u.email as author_email,
          COALESCE(u.anonymous_pseudonym, 'Campus Organizer') as actor_name,
          COALESCE(u.anonymous_number, 0) as anon_id,
          CONCAT('scheduled event: ', SUBSTRING(e.title FROM 1 FOR 30)) as action_text,
          e.created_at
        FROM events e
        JOIN users u ON e.organizer_id = u.id
        WHERE e.deleted_at IS NULL AND e.status = 'active'

        UNION ALL

        SELECT 
          al.id::text as id,
          'admin' as type,
          'Administrator' as author_real_name,
          '' as author_email,
          'Administrator' as actor_name,
          0 as anon_id,
          CONCAT('moderated: ', REPLACE(LOWER(al.action), '_', ' ')) as action_text,
          al.created_at
        FROM audit_logs al
      ) combined
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );
    return res.rows;
  },

  async listUsers(search?: string, role?: string, status?: string, limit: number = 50) {
    const params: any[] = [limit];
    let where = '1=1';

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where += ` AND (LOWER(email) LIKE $${params.length} OR LOWER(full_name) LIKE $${params.length} OR LOWER(anonymous_pseudonym) LIKE $${params.length})`;
    }
    if (role && role !== 'all') {
      params.push(role);
      where += ` AND role = $${params.length}`;
    }
    if (status && status !== 'all') {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }

    const res = await query(
      `SELECT id, email, phone_number, full_name, department, graduation_year, role, status, email_verified, phone_verified, anonymous_number, anonymous_pseudonym, reputation_score, created_at 
       FROM users 
       WHERE ${where}
       ORDER BY created_at DESC 
       LIMIT $1`,
      params
    );
    return res.rows;
  },

  async listPosts(search?: string, status?: string, limit: number = 50, offset: number = 0) {
    const params: any[] = [limit, offset];
    let where = 'p.deleted_at IS NULL';

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND p.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where += ` AND (LOWER(p.content) LIKE $${params.length} OR LOWER(p.tag) LIKE $${params.length})`;
    }

    const res = await query(
      `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.tag,
        p.status,
        p.likes_count,
        p.comments_count,
        p.created_at,
        p.updated_at,
        u.full_name as author_real_name,
        u.department as author_department,
        u.email as author_email,
        COALESCE(u.anonymous_pseudonym, 'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')) as author_name,
        COALESCE(u.anonymous_number, 0) as anon_id,
        (SELECT COUNT(*) FROM reports r WHERE r.target_type = 'post' AND r.target_id = p.id AND r.status = 'pending') as report_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      params
    );
    return res.rows;
  },

  async deletePost(id: string) {
    const res = await query(
      "UPDATE posts SET status = 'removed', deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id",
      [id]
    );
    if (res.rowCount === 0) throw new NotFoundError('Post not found');
    return { success: true, message: 'Post removed by administrator' };
  },

  async listConfessions(search?: string, limit: number = 50, offset: number = 0) {
    const params: any[] = [limit, offset];
    let where = 'c.deleted_at IS NULL';

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where += ` AND (LOWER(c.content) LIKE $${params.length} OR LOWER(c.category) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
    }

    const res = await query(
      `
      SELECT 
        c.id,
        c.content,
        c.category,
        c.status,
        c.likes_count,
        c.comments_count,
        c.anonymous_pseudonym,
        c.created_at,
        u.full_name as author_real_name,
        u.department as author_department,
        u.email as author_email,
        COALESCE(u.anonymous_number, 0) as anon_id,
        (SELECT COUNT(*) FROM reports r WHERE r.target_type = 'confession' AND r.target_id = c.id AND r.status = 'pending') as report_count
      FROM confessions c
      JOIN users u ON c.author_id = u.id
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      params
    );
    return res.rows;
  },

  async deleteConfession(id: string) {
    const res = await query(
      "UPDATE confessions SET status = 'removed', deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id",
      [id]
    );
    if (res.rowCount === 0) throw new NotFoundError('Confession not found');
    return { success: true, message: 'Confession removed by administrator' };
  },

  async listEvents(search?: string, status?: string, limit: number = 50, offset: number = 0) {
    const params: any[] = [limit, offset];
    let where = 'e.deleted_at IS NULL';

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND e.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where += ` AND (LOWER(e.title) LIKE $${params.length} OR LOWER(e.description) LIKE $${params.length} OR LOWER(e.venue) LIKE $${params.length})`;
    }

    const res = await query(
      `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.category,
        e.venue,
        e.event_date,
        e.event_time,
        e.banner_url,
        e.capacity,
        e.registrations_count,
        e.status,
        e.created_at,
        u.full_name as organizer_name,
        u.email as organizer_email,
        u.department
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE ${where}
      ORDER BY e.event_date ASC, e.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      params
    );
    return res.rows;
  },

  async createEvent(data: {
    title: string;
    description: string;
    category?: string;
    venue: string;
    event_date: string;
    event_time: string;
    capacity?: number;
    banner_url?: string;
  }, organizerId: string) {
    const res = await query(
      `
      INSERT INTO events (
        organizer_id, title, description, category, venue, event_date, event_time, capacity, banner_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        organizerId,
        data.title,
        data.description,
        data.category || 'general',
        data.venue,
        data.event_date,
        data.event_time,
        data.capacity || 100,
        data.banner_url || null
      ]
    );
    return res.rows[0];
  },

  async deleteEvent(id: string) {
    const res = await query(
      "UPDATE events SET status = 'removed', deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id",
      [id]
    );
    if (res.rowCount === 0) throw new NotFoundError('Event not found');
    return { success: true, message: 'Event cancelled/removed by administrator' };
  },

  async getAnalytics() {
    const [
      dauRes,
      postsTodayRes,
      confTodayRes,
      likesRes,
      commentsRes,
      thisWeekUsersRes,
      lastWeekUsersRes,
      contentDistRes,
      dailyUsersChartRes
    ] = await Promise.all([
      query("SELECT COUNT(DISTINCT user_id) as count FROM refresh_sessions WHERE (updated_at >= CURRENT_DATE OR created_at >= CURRENT_DATE) AND is_revoked = FALSE"),
      query("SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NULL AND status = 'active' AND created_at >= CURRENT_DATE"),
      query("SELECT COUNT(*) as count FROM confessions WHERE deleted_at IS NULL AND status = 'active' AND created_at >= CURRENT_DATE"),
      query("SELECT (SELECT COUNT(*) FROM post_likes) + (SELECT COUNT(*) FROM confession_likes) as count"),
      query("SELECT COUNT(*) as count FROM comments WHERE deleted_at IS NULL"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND created_at >= DATE_TRUNC('week', CURRENT_TIMESTAMP)"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND created_at >= DATE_TRUNC('week', CURRENT_TIMESTAMP) - INTERVAL '7 days' AND created_at < DATE_TRUNC('week', CURRENT_TIMESTAMP)"),
      query(`
        SELECT 
          (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND status = 'active')::int as total_posts,
          (SELECT COUNT(*) FROM confessions WHERE deleted_at IS NULL AND status = 'active')::int as total_confessions,
          (SELECT COUNT(*) FROM events WHERE deleted_at IS NULL AND status = 'active')::int as total_events
      `),
      query(`
        WITH days AS (
          SELECT generate_series(
            DATE_TRUNC('day', CURRENT_TIMESTAMP) - INTERVAL '6 days',
            DATE_TRUNC('day', CURRENT_TIMESTAMP),
            INTERVAL '1 day'
          )::date AS day
        )
        SELECT 
          TO_CHAR(d.day, 'Dy') AS label,
          TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
          COALESCE(COUNT(DISTINCT rs.user_id), 0)::int AS users
        FROM days d
        LEFT JOIN refresh_sessions rs ON DATE_TRUNC('day', rs.updated_at)::date = d.day AND rs.is_revoked = FALSE
        GROUP BY d.day
        ORDER BY d.day ASC
      `)
    ]);

    const dailyActiveUsers = parseInt(dauRes.rows[0]?.count || '0', 10);
    const postsToday = parseInt(postsTodayRes.rows[0]?.count || '0', 10);
    const confessionsToday = parseInt(confTodayRes.rows[0]?.count || '0', 10);
    const totalLikes = parseInt(likesRes.rows[0]?.count || '0', 10);
    const totalComments = parseInt(commentsRes.rows[0]?.count || '0', 10);
    const registrationsThisWeek = parseInt(thisWeekUsersRes.rows[0]?.count || '0', 10);
    const registrationsLastWeek = parseInt(lastWeekUsersRes.rows[0]?.count || '0', 10);
    const dist = contentDistRes.rows[0] || { total_posts: 0, total_confessions: 0, total_events: 0 };

    let dauChange = 'No previous-period data';
    if (dailyActiveUsers > 0) {
      dauChange = `+${dailyActiveUsers} active today`;
    }

    let weekChange = 'No previous-period data';
    if (registrationsLastWeek > 0) {
      const diff = registrationsThisWeek - registrationsLastWeek;
      const pct = Math.round((diff / registrationsLastWeek) * 100);
      weekChange = `${diff >= 0 ? '+' : ''}${pct}% vs last week`;
    } else if (registrationsThisWeek > 0) {
      weekChange = `+${registrationsThisWeek} new this week`;
    }

    return {
      dailyActiveUsers,
      dauChange,
      postsToday,
      confessionsToday,
      totalLikes,
      totalComments,
      registrationsThisWeek,
      weekChange,
      totalPosts: dist.total_posts,
      totalConfessions: dist.total_confessions,
      totalEvents: dist.total_events,
      chartData: dailyUsersChartRes.rows
    };
  },

  async updateUserStatus(userId: string, status: UserStatus, currentAdminId: string) {
    if (userId === currentAdminId) {
      throw new BadRequestError('Cannot change status of your own account');
    }
    const updated = await userRepo.updateStatus(userId, status);
    if (!updated) throw new NotFoundError('User not found');
    return updated;
  },

  async updateUserRole(userId: string, role: UserRole, currentAdminRole: string) {
    if (currentAdminRole !== 'super_admin') {
      throw new ForbiddenError('Only super_admin can change user roles');
    }
    const res = await query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [role, userId]);
    if (res.rowCount === 0) throw new NotFoundError('User not found');
    return res.rows[0];
  },

  async listModerationQueue(status: string = 'auto_flagged') {
    const res = await query(
      `SELECT mq.*, 
        CASE 
          WHEN mq.content_type = 'post' THEN (SELECT content FROM posts WHERE id = mq.content_id)
          WHEN mq.content_type = 'confession' THEN (SELECT content FROM confessions WHERE id = mq.content_id)
          WHEN mq.content_type = 'comment' THEN (SELECT content FROM comments WHERE id = mq.content_id)
        END as content_preview
       FROM moderation_queue mq
       WHERE mq.status = $1
       ORDER BY mq.created_at DESC`,
      [status]
    );
    return res.rows;
  },

  async reviewModerationItem(id: string, reviewerId: string, status: 'approved' | 'rejected' | 'escalated', reviewNotes?: string) {
    return await withTransaction(async (client) => {
      const itemRes = await client.query('SELECT * FROM moderation_queue WHERE id = $1', [id]);
      if (itemRes.rowCount === 0) throw new NotFoundError('Moderation queue item not found');

      const item = itemRes.rows[0];

      await client.query(
        `UPDATE moderation_queue 
         SET status = $1, reviewed_by = $2, review_notes = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [status, reviewerId, reviewNotes || null, id]
      );

      // If rejected, mark content as removed
      if (status === 'rejected') {
        if (item.content_type === 'post') {
          await client.query("UPDATE posts SET status = 'removed' WHERE id = $1", [item.content_id]);
        } else if (item.content_type === 'confession') {
          await client.query("UPDATE confessions SET status = 'removed' WHERE id = $1", [item.content_id]);
        } else if (item.content_type === 'comment') {
          await client.query("UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [item.content_id]);
        }
      } else if (status === 'approved') {
        // Restore to active status
        if (item.content_type === 'post') {
          await client.query("UPDATE posts SET status = 'active' WHERE id = $1", [item.content_id]);
        } else if (item.content_type === 'confession') {
          await client.query("UPDATE confessions SET status = 'active' WHERE id = $1", [item.content_id]);
        }
      }

      return { success: true, message: `Moderation item marked as ${status}` };
    });
  },

  async listReports(status: string = 'pending') {
    let where = '1=1';
    const params: any[] = [];
    if (status && status !== 'all') {
      params.push(status);
      where = `r.status = $${params.length}`;
    }

    const res = await query(
      `SELECT r.*, 
        u.email as reporter_email, 
        u.full_name as reporter_name,
        COALESCE(u.anonymous_number, 0) as reporter_anon_id,
        CASE 
          WHEN r.target_type = 'post' THEN (SELECT p.content FROM posts p WHERE p.id = r.target_id)
          WHEN r.target_type = 'confession' THEN (SELECT c.content FROM confessions c WHERE c.id = r.target_id)
          WHEN r.target_type = 'comment' THEN (SELECT cm.content FROM comments cm WHERE cm.id = r.target_id)
          WHEN r.target_type = 'user' THEN (SELECT u2.full_name FROM users u2 WHERE u2.id = r.target_id)
        END as content_preview,
        CASE 
          WHEN r.target_type = 'post' THEN (SELECT u_post.full_name FROM posts p JOIN users u_post ON p.author_id = u_post.id WHERE p.id = r.target_id)
          WHEN r.target_type = 'confession' THEN (SELECT u_conf.full_name FROM confessions c JOIN users u_conf ON c.author_id = u_conf.id WHERE c.id = r.target_id)
          WHEN r.target_type = 'comment' THEN (SELECT u_com.full_name FROM comments cm JOIN users u_com ON cm.author_id = u_com.id WHERE cm.id = r.target_id)
          WHEN r.target_type = 'user' THEN (SELECT u_usr.full_name FROM users u_usr WHERE u_usr.id = r.target_id)
        END as target_author_name,
        CASE 
          WHEN r.target_type = 'post' THEN (SELECT u_post.email FROM posts p JOIN users u_post ON p.author_id = u_post.id WHERE p.id = r.target_id)
          WHEN r.target_type = 'confession' THEN (SELECT u_conf.email FROM confessions c JOIN users u_conf ON c.author_id = u_conf.id WHERE c.id = r.target_id)
          WHEN r.target_type = 'comment' THEN (SELECT u_com.email FROM comments cm JOIN users u_com ON cm.author_id = u_com.id WHERE cm.id = r.target_id)
          WHEN r.target_type = 'user' THEN (SELECT u_usr.email FROM users u_usr WHERE u_usr.id = r.target_id)
        END as target_author_email,
        (SELECT COUNT(*) FROM reports sub WHERE sub.target_type = r.target_type AND sub.target_id = r.target_id) as report_count
       FROM reports r
       JOIN users u ON r.reporter_id = u.id
       WHERE ${where}
       ORDER BY r.created_at DESC`,
      params
    );
    return res.rows;
  },

  async resolveReport(
    reportId: string,
    reviewerId: string,
    status: 'reviewed' | 'action_taken' | 'dismissed',
    actionNotes?: string,
    actionToTake?: 'none' | 'remove_content' | 'ban_user' | 'suspend_user'
  ) {
    return await withTransaction(async (client) => {
      const repRes = await client.query('SELECT * FROM reports WHERE id = $1', [reportId]);
      if (repRes.rowCount === 0) throw new NotFoundError('Report not found');

      const report = repRes.rows[0];

      if (actionToTake === 'remove_content') {
        if (report.target_type === 'post') {
          await client.query("UPDATE posts SET status = 'removed', deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [report.target_id]);
        } else if (report.target_type === 'confession') {
          await client.query("UPDATE confessions SET status = 'removed', deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [report.target_id]);
        } else if (report.target_type === 'comment') {
          await client.query("UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [report.target_id]);
        }
      } else if (actionToTake === 'ban_user') {
        const userId = report.target_type === 'user' ? report.target_id : null;
        if (userId) {
          await client.query("UPDATE users SET status = 'banned' WHERE id = $1", [userId]);
        }
      } else if (actionToTake === 'suspend_user') {
        const userId = report.target_type === 'user' ? report.target_id : null;
        if (userId) {
          await client.query("UPDATE users SET status = 'suspended' WHERE id = $1", [userId]);
        }
      }

      await client.query(
        `UPDATE reports 
         SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, action_notes = $3 
         WHERE id = $4`,
        [status, reviewerId, actionNotes || null, reportId]
      );

      return { success: true, message: 'Report updated successfully' };
    });
  },

  async listAuditLogs(limit: number = 100) {
    const res = await query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
};

