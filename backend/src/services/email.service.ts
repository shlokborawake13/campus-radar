import { Resend } from 'resend';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Resend uses HTTPS (port 443) — works on Render free tier
// SMTP is blocked on Render (ports 25, 465, 587 are all blocked)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = (env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    logger.error('RESEND_API_KEY is not configured — emails cannot be sent');
    return null;
  }

  resendClient = new Resend(apiKey);
  logger.info('Resend email client initialized');
  return resendClient;
}

export const emailService = {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    logger.info('Email dispatch requested', {
      to: options.to,
      subject: options.subject
    });

    const client = getResendClient();
    if (!client) {
      logger.error('Resend client unavailable — email NOT sent', { to: options.to });
      return false;
    }

    try {
      const fromAddress = (env.RESEND_FROM || '').trim() || 'Campus Radar <onboarding@resend.dev>';

      const { data, error } = await client.emails.send({
        from: fromAddress,
        to: [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html || undefined
      });

      if (error) {
        logger.error('Resend API returned error', {
          error: error.message,
          name: error.name,
          to: options.to
        });
        return false;
      }

      logger.info('Email sent successfully via Resend', {
        emailId: data?.id,
        to: options.to
      });
      return true;
    } catch (error: any) {
      logger.error('Resend email dispatch failed', {
        error: error.message,
        statusCode: error.statusCode,
        to: options.to
      });
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
