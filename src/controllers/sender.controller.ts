import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { testConnection } from '../services/nodemailer.service.js';
import { ProviderType } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const createSenderSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    provider: z.nativeEnum(ProviderType),
    smtpHost: z.string().min(1, 'SMTP Host is required'),
    smtpPort: z.coerce.number().int().positive('SMTP Port must be a positive integer'),
    smtpUser: z.string().min(1, 'SMTP User is required'),
    smtpPass: z.string().min(1, 'SMTP Password is required'),
    skipVerify: z.boolean().optional(),
  }),
});

export const addSender = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name, email, provider, smtpHost, smtpPort, smtpUser, smtpPass, skipVerify } = req.body;

    // Temporary object used to run live verification checks
    const tempAccount = {
      id: '',
      userId,
      email,
      name,
      provider,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Run connection test before database insertion
    const testResult = await testConnection(tempAccount);
    if (!testResult.success) {
      const errCode = (testResult.error as any)?.code;
      const errMessage = (testResult.error as any)?.message || (typeof testResult.error === 'string' ? testResult.error : '') || String(testResult.error || '');

      const isNetworkError = [
        'ETIMEDOUT',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EADDRNOTAVAIL',
        'ESOCKETTIMEDOUT',
        'ERR_SOCKET_CONNECTION_TIMEOUT',
        'ENOTFOUND',
        'EAI_AGAIN'
      ].includes(errCode) || 
      errMessage.toLowerCase().includes('timeout') ||
      errMessage.toLowerCase().includes('connection') ||
      errMessage.toLowerCase().includes('dns') ||
      errMessage.toLowerCase().includes('getaddrinfo') ||
      errMessage.toLowerCase().includes('unreachable');

      if (!isNetworkError && skipVerify !== true) {
        return res.status(400).json({
          error: 'SMTPConnectionError',
          message: 'SMTP credentials test failed. Please verify configurations, hostname, port, and credentials.',
          details: errMessage || testResult.error,
        });
      }

      logger.warn(`SMTP connection test failed for ${email} with error code ${errCode} / message "${errMessage}", but proceeding due to ${isNetworkError ? 'network/hosting restriction' : 'skipVerify flag'}.`);
    }

    const senderAccount = await prisma.senderAccount.create({
      data: {
        userId,
        email,
        name,
        provider,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
      },
    });

    return res.status(201).json({
      message: 'Sender account registered successfully.',
      senderAccount: {
        id: senderAccount.id,
        name: senderAccount.name,
        email: senderAccount.email,
        provider: senderAccount.provider,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getSenders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const senders = await prisma.senderAccount.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        name: true,
        provider: true,
        createdAt: true,
      },
    });
    return res.json(senders);
  } catch (error) {
    return next(error);
  }
};
