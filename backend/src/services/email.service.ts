import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;
let transporterVerified = false;

function getCleanSmtpConfig() {
  const rawHost = (env.SMTP_HOST || '').trim();
  const rawUser = (env.SMTP_USER || '').trim();
  const rawPass = (env.SMTP_PASS || '').trim().replace(/\s+/g, '');
  const port = Number(env.SMTP_PORT) || 587;
  const isSecure = env.SMTP_SECURE === true || port === 465;

  return {
    host: rawHost,
    user: rawUser,
    pass: rawPass,
    port,
    secure: isSecure,
    isValid: Boolean(rawHost && rawUser && rawPass)
  };
}

async function getVerifiedTransporter(): Promise<Transporter | null> {
  const config = getCleanSmtpConfig();

  if (!config.isValid) {
    logger.error('SMTP credentials are missing — cannot send emails', {
      hasHost: !!config.host,
      hasUser: !!config.user,
      hasPass: !!config.pass
    });
    return null;
  }

  // If we already have a verified transporter, return it
  if (transporter && transporterVerified) {
    return transporter;
  }

  // Create fresh transporter (reset cached one if verification previously failed)
  transporter = null;
  transporterVerified = false;

  const isGmail = config.host.includes('gmail.com') || config.user.includes('@gmail.com');

  try {
    if (isGmail) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.user,
          pass: config.pass
        },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000
      });
    } else {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass
        },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000,
        tls: {
          rejectUnauthorized: false
        }
      });
    }

    // Verify SMTP connection is actually working before caching
    await transporter.verify();
    transporterVerified = true;

    logger.info('SMTP transporter verified and ready', {
      host: config.host,
      port: config.port,
      isGmail,
      user: config.user.substring(0, 5) + '***'
    });

    return transporter;
  } catch (error: any) {
    logger.error('SMTP transporter verification failed — emails will NOT be sent', {
      error: error.message,
      code: error.code,
      host: config.host,
      port: config.port,
      isGmail
    });
    transporter = null;
    transporterVerified = false;
    return null;
  }
}

export const emailService = {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const config = getCleanSmtpConfig();

    logger.info('Email dispatch requested', {
      to: options.to,
      subject: options.subject,
      smtpConfigured: config.isValid
    });

    if (!config.isValid) {
      logger.error('SMTP not configured — email NOT sent', { to: options.to });
      return false;
    }

    const mailTransporter = await getVerifiedTransporter();
    if (!mailTransporter) {
      logger.error('SMTP transporter unavailable — email NOT sent', { to: options.to });
      return false;
    }

    try {
      // For Gmail SMTP, sender address must match the authenticated account
      const isGmail = config.host.includes('gmail.com') || config.user.includes('@gmail.com');
      const fromAddress = isGmail
        ? `"Campus Radar" <${config.user}>`
        : (env.SMTP_FROM || `"Campus Radar" <${config.user}>`);

      const info = await mailTransporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      });

      logger.info('Email sent successfully via SMTP', {
        messageId: info?.messageId,
        to: options.to,
        accepted: info?.accepted,
        rejected: info?.rejected
      });
      return true;
    } catch (error: any) {
      logger.error('SMTP email dispatch failed', {
        error: error.message,
        code: error.code,
        command: error.command,
        to: options.to
      });

      // Reset cached transporter so next attempt creates a fresh one
      transporter = null;
      transporterVerified = false;

      return false;
    }
  },

  async sendVerificationOTP(email: string, otp: string): Promise<boolean> {
    const subject = 'Campus Radar — University Verification Code';
    const text = `Welcome to Campus Radar!\n\nYour 6-digit university verification code is: ${otp}\n\nThis code will expire in ${env.OTP_EXPIRY_MINUTES} minutes. For security reasons, never share this code with anyone.\n\n— The Campus Radar Team`;
    
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background-color: #FAFAFA; border: 1px solid #EEEEEE; border-radius: 12px; color: #1A1A1A;">
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">CAMPUS RADAR</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #6B7280;">Sanjivani University Student Network</p>
        </div>
        <div style="background-color: #FFFFFF; padding: 28px; border-radius: 8px; border: 1px solid #E5E7EB;">
          <p style="font-size: 15px; margin: 0 0 16px 0; color: #374151;">Hello,</p>
          <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px 0; color: #374151;">Use the verification code below to verify your student account and access the campus network:</p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563EB; background: #EFF6FF; padding: 12px 28px; border-radius: 8px; border: 1px dashed #93C5FD;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #6B7280; margin: 24px 0 0 0; line-height: 1.5;">This verification code is valid for <strong>${env.OTP_EXPIRY_MINUTES} minutes</strong>. If you did not request this, you can safely ignore this email.</p>
        </div>
        <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin: 24px 0 0 0;">Campus Radar &bull; Exclusive for verified Sanjivani University students</p>
      </div>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }
};
