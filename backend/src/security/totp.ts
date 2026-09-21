import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

export function generateTOTPSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function createTOTPInstance(email: string, secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: env.TOTP_ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32)
  });
}

export async function generateTOTPQRCode(email: string, secretBase32: string): Promise<string> {
  const totp = createTOTPInstance(email, secretBase32);
  const uri = totp.toString();
  return QRCode.toDataURL(uri);
}

export function verifyTOTPToken(token: string, secretBase32: string, email: string): boolean {
  const totp = createTOTPInstance(email, secretBase32);
  // delta of 1 allows for clock drift of +/- 30 seconds
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
