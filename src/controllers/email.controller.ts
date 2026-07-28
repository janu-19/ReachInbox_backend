import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { scheduleCampaign, generateCampaignPreview } from '../services/email.service.js';
import { EmailStatus } from '@prisma/client';

export const scheduleCampaignSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Campaign name is required'),
    subject: z.string().min(1, 'Subject is required'),
    body: z.string().min(1, 'Body template is required'),
    senderAccountId: z.string().uuid('Invalid sender account ID'),
    startTime: z.string().datetime({ message: 'Invalid ISO start time string' }).transform((val) => new Date(val)),
    delaySeconds: z.number().int().positive().default(2),
    hourlyLimit: z.number().int().positive().default(100),
    recipients: z.array(
      z.object({
        email: z.string().email('Invalid recipient email address'),
        variables: z.record(z.string()).optional(),
      })
    ).nonempty('Recipients list cannot be empty'),
  }),
});

export const scheduleEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      name,
      subject,
      body,
      senderAccountId,
      startTime,
      delaySeconds,
      hourlyLimit,
      recipients,
    } = req.body;

    const result = await scheduleCampaign({
      userId,
      senderAccountId,
      name,
      subject,
      body,
      startTime: new Date(startTime),
      delaySeconds,
      hourlyLimit,
      recipients,
    });

    return res.status(201).json({
      message: 'Campaign scheduled successfully.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as EmailStatus;
    const campaignId = req.query.campaignId as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {
      campaign: {
        userId,
      },
    };

    if (status) {
      where.status = status;
    }

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (search) {
      where.recipient = {
        contains: search,
      };
    }

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledTime: 'asc' },
        include: {
          campaign: {
            select: {
              name: true,
              subject: true,
            },
          },
        },
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    return res.json({
      data: emails,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getScheduledEmails = async (req: Request, res: Response, next: NextFunction) => {
  req.query.status = EmailStatus.SCHEDULED;
  return getEmails(req, res, next);
};

export const getSentEmails = async (req: Request, res: Response, next: NextFunction) => {
  req.query.status = EmailStatus.SENT;
  return getEmails(req, res, next);
};

export const getEmailById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const email = await prisma.scheduledEmail.findFirst({
      where: {
        id,
        campaign: {
          userId,
        },
      },
      include: {
        campaign: true,
      },
    });

    if (!email) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: 'Email record not found or access denied.',
      });
    }

    return res.json(email);
  } catch (error) {
    return next(error);
  }
};

export const previewCampaignSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Campaign name is required'),
    subject: z.string().min(1, 'Subject is required'),
    body: z.string().min(1, 'Body template is required'),
    senderAccountId: z.string().uuid('Invalid sender account ID'),
    startTime: z.string().datetime({ message: 'Invalid ISO start time string' }).transform((val) => new Date(val)),
    delaySeconds: z.number().int().positive().default(2),
    hourlyLimit: z.number().int().positive().default(100),
    recipients: z.array(
      z.object({
        email: z.string().optional().or(z.literal('')),
        variables: z.record(z.string()).optional(),
      })
    ).nonempty('Recipients list cannot be empty'),
  }),
});

export const previewCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, subject, body, senderAccountId, startTime, delaySeconds, hourlyLimit, recipients } = req.body;

    const result = await generateCampaignPreview({
      name,
      subject,
      body,
      senderAccountId,
      startTime: new Date(startTime),
      delaySeconds,
      hourlyLimit,
      recipients,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
