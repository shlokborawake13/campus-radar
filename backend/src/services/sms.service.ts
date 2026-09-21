import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const smsService = {
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    logger.info('SMS dispatch triggered', {
      phone: phoneNumber,
      environment: env.NODE_ENV
    });

    if (env.NODE_ENV !== 'production') {
      console.log('================ [MOCK SMS SERVICE] ================');
      console.log(`Phone: ${phoneNumber}`);
      console.log(`Message: ${message}`);
      console.log('====================================================');
    }

    return true;
  }
};
