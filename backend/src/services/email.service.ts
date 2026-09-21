import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let smtpTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter | null {
  if (smtpTransporter) return smtpTransporter;

  const host = (env.SMTP_HOST || 'smtp.gmail.com').trim();
  const user = (env.SMTP_USER || '').trim();
  // Strip any spaces from app password (e.g. "jmiz wvcn wqxj sxkn" -> "jmizwvcnwqxjsxkn")
  const pass = (env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = Number(env.SMTP_PORT) || 465;
  const secure = env.SMTP_SECURE !== false && port === 465;

  if (!host || !user || !pass) {
    logger.error('SMTP credentials are incomplete — emails cannot be sent', {
      hasHost: !!host,
      hasUser: !!user,
      hasPass: !!pass
    });
    return null;
  }

  const isGmail = host.toLowerCase().includes('gmail.com') || user.toLowerCase().endsWith('@gmail.com');

  if (isGmail) {
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  } else {
    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: false }
    });
  }

  return smtpTransporter;
}

/**
 * Startup diagnostic: verifies SMTP connectivity and credentials.
 */
export async function initEmailService(): Promise<void> {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    logger.warn('SMTP configuration: incomplete — check SMTP_HOST, SMTP_USER, SMTP_PASS');
    return;
  }

  try {
    await transporter.verify();
    logger.info('SMTP service ready: connected and verified successfully', {
      host: env.SMTP_HOST || 'smtp.gmail.com',
      user: env.SMTP_USER
    });
  } catch (err: any) {
    logger.error('SMTP service error: verification failed', {
      error: err.message,
      code: err.code
    });
  }
}

/**
 * Core email delivery via Nodemailer SMTP.
 */
async function sendViaSmtp(options: EmailOptions): Promise<boolean> {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    logger.error('SMTP transporter unavailable — email NOT sent', { to: options.to });
    return false;
  }

  try {
    const user = (env.SMTP_USER || '').trim();
    const fromAddress = env.SMTP_FROM || `"Campus Radar" <${user}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });

    logger.info('Email sent successfully via SMTP', {
      messageId: info?.messageId,
      to: options.to
    });
    return true;
  } catch (error: any) {
    logger.error('SMTP dispatch failed', {
      error: error.message,
      code: error.code,
      to: options.to
    });
    // Reset cached transporter so subsequent attempts create a fresh connection
    smtpTransporter = null;
    return false;
  }
}

export const emailService = {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    logger.info('Email dispatch requested', { to: options.to, subject: options.subject });
    return sendViaSmtp(options);
  },

  async sendVerificationOTP(email: string, otp: string): Promise<boolean> {
    const subject = 'Your Campus Radar verification code';

    const text = [
      'Campus Radar',
      '',
      'Verify your email address',
      '',
      `Your verification code is: ${otp}`,
      '',
      `This code expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
      '',
      "If you didn't request this code, you can safely ignore this email.",
      '',
      'Do not share this code with anyone.',
      '',
      '— Campus Radar'
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#111827;padding:28px 32px;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Campus Radar</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;">Verify your email address</h2>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">Your verification code is:</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;font-size:36px;font-weight:800;letter-spacing:10px;color:#2563eb;background:#eff6ff;padding:16px 32px;border-radius:10px;border:2px dashed #93c5fd;">${otp}</span>
      </div>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">This code expires in <strong>${env.OTP_EXPIRY_MINUTES} minutes</strong>.</p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">If you didn't request this code, you can safely ignore this email.</p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#6b7280;"><strong>Do not share this code with anyone.</strong></p>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Campus Radar &bull; Sanjivani University Student Network</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail({ to: email, subject, text, html });
  }
};
