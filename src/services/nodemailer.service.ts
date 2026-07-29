import nodemailer from 'nodemailer';
import { SenderAccount } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const createTransporter = async (account: SenderAccount) => {
  logger.info(`Entered createTransporter(). BYPASS_SMTP_VERIFICATION=${process.env.BYPASS_SMTP_VERIFICATION}`);

  if (process.env.BYPASS_SMTP_VERIFICATION === 'true') {
    logger.info('[TRANSPORTER] BYPASS_SMTP_VERIFICATION is enabled. Using simulated mock SMTP transport.');
    return {
      sendMail: async (options: any) => {
        logger.info(`[SIMULATED SMTP] Delivered mail to ${options.to} (Subject: ${options.subject})`);
        return {
          messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        };
      },
      verify: async () => true,
    } as any;
  }

  if (account.provider === 'ETHEREAL') {
    let user = account.smtpUser;
    let pass = account.smtpPass;

    // Check if we need to resolve placeholders using test account creator
    if (user.includes('placeholder') || pass.includes('placeholder')) {
      if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS && !process.env.ETHEREAL_USER.includes('placeholder')) {
        user = process.env.ETHEREAL_USER;
        pass = process.env.ETHEREAL_PASS;
      } else {
        logger.info('Generating dynamic Ethereal SMTP test account on-the-fly...');
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        // Save to environment variables so subsequent sends in this session reuse it
        process.env.ETHEREAL_USER = user;
        process.env.ETHEREAL_PASS = pass;
        logger.info(`Generated Ethereal Credentials: User = ${user}, Pass = ${pass}`);
      }
    }

    logger.info(`[TRANSPORTER] Using Ethereal SMTP: host=smtp.ethereal.email, port=587, user=${user}`);

    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // Ethereal uses STARTTLS
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  logger.info(`[TRANSPORTER] Using Generic SMTP: host=${account.smtpHost}, port=${account.smtpPort}, user=${account.smtpUser}`);

  // Generic SMTP connection settings (covers Gmail, Outlook, and customized servers)
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465, // SSL for 465, TLS/STARTTLS for 587/25
    auth: {
      user: account.smtpUser,
      pass: account.smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

export const testConnection = async (account: SenderAccount): Promise<{ success: boolean; error?: any }> => {
  try {
    const transporter = await createTransporter(account);
    await transporter.verify();
    return { success: true };
  } catch (error) {
    logger.error(`SMTP connection test failed for sender account: ${account.email}`, error);
    return { success: false, error };
  }
};
