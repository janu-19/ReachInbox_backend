import nodemailer from 'nodemailer';
import { SenderAccount } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const createTransporter = async (account: SenderAccount) => {
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

    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // Ethereal uses STARTTLS
      auth: {
        user,
        pass,
      },
    });
  }

  // Generic SMTP connection settings (covers Gmail, Outlook, and customized servers)
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465, // SSL for 465, TLS/STARTTLS for 587/25
    auth: {
      user: account.smtpUser,
      pass: account.smtpPass,
    },
  });
};

export const testConnection = async (account: SenderAccount): Promise<boolean> => {
  try {
    const transporter = await createTransporter(account);
    await transporter.verify();
    return true;
  } catch (error) {
    logger.error(`SMTP connection test failed for sender account: ${account.email}`, error);
    return false;
  }
};
