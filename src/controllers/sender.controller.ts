import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { testConnection } from '../services/nodemailer.service.js';
import { ProviderType } from '@prisma/client';

export const createSenderSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    provider: z.nativeEnum(ProviderType),
    smtpHost: z.string().min(1, 'SMTP Host is required'),
    smtpPort: z.number().int().positive('SMTP Port must be a positive integer'),
    smtpUser: z.string().min(1, 'SMTP User is required'),
    smtpPass: z.string().min(1, 'SMTP Password is required'),
  }),
});

export const addSender = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name, email, provider, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

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
    const isConnected = await testConnection(tempAccount);
    if (!isConnected) {
      return res.status(400).json({
        error: 'SMTPConnectionError',
        message: 'SMTP credentials test failed. Please verify configurations, hostname, port, and credentials.',
      });
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
