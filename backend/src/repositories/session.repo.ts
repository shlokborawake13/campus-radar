import { query } from '../config/database.js';

export interface RefreshSessionRecord {
  id: string;
  user_id: string;
  token_family: string;
  token_hash: string;
  is_revoked: boolean;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export const sessionRepo = {
  async create(data: {
    userId: string;
    tokenFamily: string;
    tokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<RefreshSessionRecord> {
    const res = await query<RefreshSessionRecord>(
      `INSERT INTO refresh_sessions 
       (user_id, token_family, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.userId,
        data.tokenFamily,
        data.tokenHash,
        data.userAgent || null,
        data.ipAddress || null,
        data.expiresAt
      ]
    );
    return res.rows[0];
  },

  async findByTokenHash(tokenHash: string): Promise<RefreshSessionRecord | null> {
    const res = await query<RefreshSessionRecord>(
      'SELECT * FROM refresh_sessions WHERE token_hash = $1',
      [tokenHash]
    );
    return res.rows[0] || null;
  },

  async revokeToken(id: string): Promise<void> {
    await query(
      'UPDATE refresh_sessions SET is_revoked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  },

  async revokeFamily(tokenFamily: string): Promise<void> {
    await query(
      'UPDATE refresh_sessions SET is_revoked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE token_family = $1',
      [tokenFamily]
    );
  },

  async revokeAllUserSessions(userId: string): Promise<void> {
    await query(
      'UPDATE refresh_sessions SET is_revoked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
  },

  /**
   * Enforce a maximum number of active session families per user.
   * Revokes the oldest families if the limit is exceeded.
   */
  async enforceMaxSessions(userId: string, maxSessions: number): Promise<void> {
    // Get all active (non-revoked, non-expired) token families ordered by newest first
    const res = await query<{ token_family: string }>(
      `SELECT DISTINCT token_family 
       FROM refresh_sessions 
       WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > CURRENT_TIMESTAMP 
       ORDER BY token_family`,
      [userId]
    );

    if (res.rowCount && res.rowCount > maxSessions) {
      // Keep the newest maxSessions families, revoke the rest
      const familiesToKeep = res.rows.slice(-maxSessions).map((r: { token_family: string }) => r.token_family);
      await query(
        `UPDATE refresh_sessions 
         SET is_revoked = TRUE, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND is_revoked = FALSE AND token_family != ALL($2)`,
        [userId, familiesToKeep]
      );
    }
  }
};
