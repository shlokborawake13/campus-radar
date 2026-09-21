import { pool } from '../config/database.js';
import { hashPassword } from '../security/password.js';
import { generateTOTPSecret, generateTOTPQRCode } from '../security/totp.js';
import { logger } from '../utils/logger.js';

async function seedSuperAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sanjivani.edu.in';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SuperAdmin#CampusRadar2026!';
  const adminName = process.env.ADMIN_NAME || 'Super Administrator';

  logger.info('Running idempotent super_admin seeding...', { email: adminEmail });

  const existingRes = await pool.query('SELECT id, email, role, totp_secret, totp_enabled FROM users WHERE LOWER(email) = LOWER($1)', [adminEmail]);

  const passwordHash = await hashPassword(adminPassword);
  const totpSecret = generateTOTPSecret();

  if (existingRes.rowCount && existingRes.rowCount > 0) {
    const existing = existingRes.rows[0];
    logger.info(`Admin account ${adminEmail} already exists. Updating credentials and elevating to super_admin...`);

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

    console.log('\n================ SUPER ADMIN READY ================');
    console.log(`Email:       ${adminEmail}`);
    console.log(`Role:        super_admin`);
    console.log(`TOTP Secret: ${secretToUse}`);
    console.log(`TOTP QR Data URL: ${qrDataUrl.substring(0, 50)}...`);
    console.log('===================================================\n');
  } else {
    logger.info(`Creating initial super_admin account for ${adminEmail}...`);

    await pool.query(
      `INSERT INTO users 
       (email, password_hash, full_name, department, role, status, email_verified, totp_secret, totp_enabled)
       VALUES ($1, $2, $3, 'Administration', 'super_admin', 'active', TRUE, $4, FALSE)`,
      [adminEmail, passwordHash, adminName, totpSecret]
    );

    const qrDataUrl = await generateTOTPQRCode(adminEmail, totpSecret);

    console.log('\n================ SUPER ADMIN CREATED ================');
    console.log(`Email:             ${adminEmail}`);
    console.log(`Temporary Password: ${adminPassword}`);
    console.log(`Role:              super_admin`);
    console.log(`TOTP Secret:       ${totpSecret}`);
    console.log(`TOTP QR Data URL:  ${qrDataUrl.substring(0, 50)}...`);
    console.log('Scan the secret into Google Authenticator / Authy to complete MFA setup.');
    console.log('=====================================================\n');
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
