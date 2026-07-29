import { prisma } from '../config/db.js';
import { EmailStatus } from '@prisma/client';
import { emailQueue } from '../queue/email.queue.js';
import { logger } from '../utils/logger.js';

export async function recoverPendingEmails() {
  try {
    logger.info('Running startup email crash/restart recovery check...');

    // Find all emails stuck in SENDING or SCHEDULED with scheduledTime <= now
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        OR: [
          {
            status: EmailStatus.SENDING,
          },
          {
            status: EmailStatus.SCHEDULED,
            scheduledTime: {
              lte: new Date(),
            },
          },
        ],
      },
    });

    if (pendingEmails.length === 0) {
      logger.info('Recovery check completed: 0 pending/interrupted emails found.');
      return;
    }

    logger.info(`Found ${pendingEmails.length} pending/interrupted emails to recover.`);

    const now = Date.now();
    for (const email of pendingEmails) {
      // Revert status to SCHEDULED if stuck in SENDING so worker processes cleanly
      if (email.status === EmailStatus.SENDING) {
        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: { status: EmailStatus.SCHEDULED },
        });
      }

      const delay = Math.max(0, email.scheduledTime.getTime() - now);

      await emailQueue.add(
        'send-email',
        { emailId: email.id },
        {
          delay,
          jobId: email.id,
        }
      );

      logger.info(`Successfully recovered and re-queued email ${email.id} (Delay: ${delay}ms)`);
    }

    logger.info(`Email recovery completed: Re-queued ${pendingEmails.length} jobs.`);
  } catch (error) {
    logger.error('Error executing startup email recovery service:', error);
  }
}
