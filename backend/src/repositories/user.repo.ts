import { query } from '../config/database.js';
import { UserRole, UserStatus } from '../types/index.js';

export interface UserRecord {
  id: string;
  email: string;
  phone_number: string | null;
  password_hash: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  department: string | null;
  graduation_year: number | null;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  phone_verified: boolean;
  verified_at: Date | null;
  verification_method: string | null;
  totp_secret: string | null;
  totp_enabled: boolean;
  anonymous_number: number;
  anonymous_pseudonym: string;
  reputation_score: number;
  created_at: Date;
  updated_at: Date;
}

export const userRepo = {
  async findById(id: string): Promise<UserRecord | null> {
    const res = await query<UserRecord>('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByEmail(email: string): Promise<UserRecord | null> {
    const res = await query<UserRecord>('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    return res.rows[0] || null;
  },

  async findByPhoneNumber(phone: string): Promise<UserRecord | null> {
    const cleanPhone = phone.trim();
    const digitsOnly = cleanPhone.replace(/[^0-9]/g, '');
    const res = await query<UserRecord>(
      `SELECT * FROM users 
       WHERE phone_number = $1 
          OR phone_number = $2 
          OR phone_number = $3 
          OR RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), 10) = $4`,
      [cleanPhone, digitsOnly, `+91${digitsOnly.slice(-10)}`, digitsOnly.slice(-10)]
    );
    return res.rows[0] || null;
  },

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    department?: string;
    graduationYear?: number;
    phoneNumber?: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<UserRecord> {
    const insertRes = await query<UserRecord>(
      `INSERT INTO users 
       (email, password_hash, full_name, department, graduation_year, phone_number, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.email.toLowerCase().trim(),
        data.passwordHash,
        data.fullName,
        data.department || null,
        data.graduationYear || null,
        data.phoneNumber || null,
        data.role || 'student',
        data.status || 'pending_verification'
      ]
    );

    const user = insertRes.rows[0];
    if (user && !user.anonymous_pseudonym) {
      const updateRes = await query<UserRecord>(
        `UPDATE users 
         SET anonymous_pseudonym = 'Anonymous #' || LPAD(anonymous_number::text, 2, '0')
         WHERE id = $1
         RETURNING *`,
        [user.id]
      );
      return updateRes.rows[0] || user;
    }

    return user;
  },

  async markEmailVerified(userId: string): Promise<UserRecord> {
    const res = await query<UserRecord>(
      `UPDATE users 
       SET email_verified = TRUE, status = 'active', verified_at = CURRENT_TIMESTAMP, verification_method = 'email_otp', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    return res.rows[0];
  },

  async updateTotpSecret(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    await query(
      `UPDATE users 
       SET totp_secret = $1, totp_enabled = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [secret, enabled, userId]
    );
  },

  async updateStatus(userId: string, status: UserStatus): Promise<UserRecord> {
    const res = await query<UserRecord>(
      `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, userId]
    );
    return res.rows[0];
  }
};
