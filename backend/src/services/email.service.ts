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

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true for 465, false for other ports (587, 25)
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
    logger.info('Initialized SMTP email transporter', { host: env.SMTP_HOST, port: env.SMTP_PORT });
  }

  return transporter;
}

export const emailService = {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const mailTransporter = getTransporter();

    logger.info('Email dispatch triggered', {
      to: options.to,
      subject: options.subject,
      hasSmtp: !!mailTransporter
    });

    if (mailTransporter) {
      try {
        const info = await mailTransporter.sendMail({
          from: env.SMTP_FROM,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html
        });
        logger.info('Email sent successfully via SMTP', { messageId: info.messageId, to: options.to });
        return true;
      } catch (error: any) {
        logger.warn('SMTP email dispatch failed, proceeding with registration flow', { error: error.message, to: options.to });
        return false;
      }
    } else {
      if (env.NODE_ENV === 'production') {
        logger.warn('SMTP credentials not configured in environment. Verification email simulated.', { to: options.to });
      } else {
        // Development console fallback when SMTP credentials are not yet configured in .env
        console.log('\n================ [EMAIL OTP DISPATCH] ================');
        console.log(`From:    ${env.SMTP_FROM}`);
        console.log(`To:      ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body:    ${options.text}`);
        console.log('------------------------------------------------------');
        console.log('NOTE: To send real emails, set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env');
        console.log('======================================================\n');
      }
      return true;
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
