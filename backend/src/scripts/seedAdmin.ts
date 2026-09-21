import { pool } from '../config/database.js';
import { hashPassword } from '../security/password.js';
import { generateTOTPSecret, generateTOTPQRCode } from '../security/totp.js';
import { logger } from '../utils/logger.js';

async function seedSuperAdmin() {
  const isProduction = process.env.NODE_ENV === 'production';
  const adminEmail = process.env.ADMIN_EMAIL || (isProduction ? '' : 'admin@sanjivani.edu.in');
  const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'DevAdmin#2026!Secure');
  const adminName = process.env.ADMIN_NAME || 'Super Administrator';

  if (!adminEmail || !adminPassword) {
    logger.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required to seed admin');
    process.exit(1);
  }

  logger.info('Running idempotent super_admin seeding...', { email: adminEmail });

  const existingRes = await pool.query('SELECT id, email, role, totp_secret, totp_enabled FROM users WHERE LOWER(email) = LOWER($1)', [adminEmail]);

  const passwordHash = await hashPassword(adminPassword);
  const totpSecret = generateTOTPSecret();

  if (existingRes.rowCount && existingRes.rowCount > 0) {
    const existing = existingRes.rows[0];
    logger.info(`Admin account exists. Updating credentials and elevating to super_admin...`, { email: adminEmail });

    await pool.query(
      `UPDATE users 
       SET password_hash = $1, role = 'super_admin', status = 'active', email_verified = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, existing.id]
    );

    const secretToUse = existing.totp_secret || totpSecret;
    if (!existing.totp_secret) {
      await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [totpSecret, existing.id]);
    }

    const qrDataUrl = await generateTOTPQRCode(adminEmail, secretToUse);

    if (!isProduction) {
      console.log('\n================ SUPER ADMIN READY ================');
      console.log(`Email:       ${adminEmail}`);
      console.log(`Role:        super_admin`);
      console.log(`TOTP Secret: ${secretToUse}`);
      console.log(`TOTP QR Data URL: ${qrDataUrl.substring(0, 50)}...`);
      console.log('===================================================\n');
    } else {
      logger.info('Super admin account credentials successfully updated in database.', { email: adminEmail });
    }
  } else {
    logger.info(`Creating initial super_admin account...`, { email: adminEmail });

    await pool.query(
      `INSERT INTO users 
       (email, password_hash, full_name, department, role, status, email_verified, totp_secret, totp_enabled)
       VALUES ($1, $2, $3, 'Administration', 'super_admin', 'active', TRUE, $4, FALSE)`,
      [adminEmail, passwordHash, adminName, totpSecret]
    );

    const qrDataUrl = await generateTOTPQRCode(adminEmail, totpSecret);

    if (!isProduction) {
      console.log('\n================ SUPER ADMIN CREATED ================');
      console.log(`Email:             ${adminEmail}`);
      console.log(`Temporary Password: ${adminPassword}`);
      console.log(`Role:              super_admin`);
      console.log(`TOTP Secret:       ${totpSecret}`);
      console.log(`TOTP QR Data URL:  ${qrDataUrl.substring(0, 50)}...`);
      console.log('Scan the secret into Google Authenticator / Authy to complete MFA setup.');
      console.log('=====================================================\n');
    } else {
      logger.info('Super admin account successfully provisioned in database.', { email: adminEmail });
    }
  }
}

seedSuperAdmin()
  .then(() => {
    logger.info('Super admin provisioning completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Failed to seed super admin', { error: err.message, stack: err.stack });
    process.exit(1);
  });
