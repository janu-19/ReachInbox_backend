import nodemailer from 'nodemailer';

// Stub nodemailer createTransport to mock external SMTP network calls for deterministic tests
nodemailer.createTransport = () => {
  return {
    sendMail: async (options: any) => {
      console.log(`[MOCK SMTP] Dispatched mail to ${options.to} (Subject: ${options.subject})`);
      return {
        messageId: `mock-msg-${Math.random().toString(36).substring(7)}`,
      };
    },
  } as any;
};

import { prisma } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { emailQueue } from '../queue/email.queue.js';
import { scheduleEmails } from '../controllers/email.controller.js';
import { sendScheduledEmail } from '../services/email.service.js';
import { EmailStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Simple Assertion Helper
const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
};

async function runTests() {
  console.log('==================================================');
  console.log('STARTING INTEGRATION TESTING SUITE');
  console.log('==================================================');

  // Clear previous test keys in Redis
  const testKeys = await redisClient.keys('sender:rate:*');
  if (testKeys.length > 0) {
    await redisClient.del(...testKeys);
  }

  // 1. Setup Mock User & Sender Account records in database
  const user = await prisma.user.upsert({
    where: { email: 'test_dev@example.com' },
    update: {},
    create: {
      email: 'test_dev@example.com',
      name: 'Test Dev Account',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
    },
  });

  const senderAccount = await prisma.senderAccount.upsert({
    where: { email: 'test_sender@ethereal.email' },
    update: {},
    create: {
      userId: user.id,
      name: 'Mock Test Sender',
      email: 'test_sender@ethereal.email',
      provider: 'ETHEREAL',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUser: 'placeholder_user',
      smtpPass: 'placeholder_pass',
    },
  });

  // ==========================================
  // TEST 1: API Request Validation & Processing
  // ==========================================
  console.log('\n--- Running Test 1: API Campaign Scheduling ---');
  
  // Clean up previous test campaigns to prevent clutter
  await prisma.campaign.deleteMany({
    where: { userId: user.id, name: 'Integration Test Campaign' },
  });

  // Construct request simulation inputs
  const mockReq = {
    body: {
      name: 'Integration Test Campaign',
      subject: 'Hello {{ name }}',
      body: 'Welcome to ReachInbox integration test suite.',
      senderAccountId: senderAccount.id,
      startTime: new Date(Date.now() + 5000), // Pass Date object directly for direct controller test
      delaySeconds: 3,
      hourlyLimit: 2, // Low threshold to trigger rate checks later
      recipients: [
        { email: 'recip1@test.com', variables: { name: 'Alice' } },
        { email: 'recip2@test.com', variables: { name: 'Bob' } },
        { email: 'recip3@test.com', variables: { name: 'Charlie' } }, // Third recipient should exceed limit of 2/hr
      ],
    },
    user: { id: user.id, email: user.email },
  } as any;

  let responseCode = 200;
  let responseBody: any = null;

  const mockRes = {
    status: (code: number) => {
      responseCode = code;
      return mockRes;
    },
    json: (data: any) => {
      responseBody = data;
      return mockRes;
    },
  } as any;

  await scheduleEmails(mockReq, mockRes, (err) => {
    if (err) throw err;
  });

  assert(responseCode === 201, 'API schedule request returned 201 Created status.');
  assert(responseBody.campaignId !== undefined, 'API response returned campaign ID.');
  assert(responseBody.totalScheduled === 3, 'API reported 3 scheduled recipients.');

  // ==========================================
  // TEST 2: Queue Registry Persistence
  // ==========================================
  console.log('\n--- Running Test 2: Queue Registry Persistence ---');
  const campaignId = responseBody.campaignId;
  const dbEmails = await prisma.scheduledEmail.findMany({
    where: { campaignId },
    orderBy: { scheduledTime: 'asc' },
  });

  assert(dbEmails.length === 3, 'Found exactly 3 database rows for scheduled emails.');

  // Check BullMQ registration
  const jobCount = await emailQueue.getJobCountByTypes('delayed');
  assert(jobCount >= 3, 'Asserted that scheduled jobs exist in BullMQ Redis delayed set.');

  // ==========================================
  // TEST 3: Worker Dispatch & Idempotency Gate
  // ==========================================
  console.log('\n--- Running Test 3: Worker Dispatch & Idempotency ---');
  
  // Grab the first recipient record (Alice)
  const firstEmail = dbEmails[0];

  // Mock a mock job representation
  const mockJob = {
    id: firstEmail.id,
    moveToDelayed: async () => {},
  } as any;

  // Temporarily stub requireAuth-like mock check and execute dispatch
  await sendScheduledEmail(firstEmail.id, 'mock-token', mockJob);

  // Read updated state
  const updatedFirst = await prisma.scheduledEmail.findUnique({
    where: { id: firstEmail.id },
  });

  assert(updatedFirst?.status === EmailStatus.SENT, 'Email status changed successfully to SENT in database.');
  assert(updatedFirst?.sentTime !== null, 'Sent timestamp recorded successfully.');
  assert(updatedFirst?.error === null, 'Error logs are clean for successful send.');

  // Execute again to test Idempotency Gate
  console.log('Triggering duplicate dispatch for same record ID...');
  const consoleSpy = console.log;
  let skippedLogTriggered = false;
  console.log = (...args) => {
    if (args.join(' ').includes('already marked as SENT')) {
      skippedLogTriggered = true;
    }
    consoleSpy(...args);
  };

  await sendScheduledEmail(firstEmail.id, 'mock-token', mockJob);
  console.log = consoleSpy;

  assert(skippedLogTriggered, 'Idempotency Gate triggered: email marked SENT was bypassed on double dispatch.');

  // ==========================================
  // TEST 4: Configurable Rate Limiting
  // ==========================================
  console.log('\n--- Running Test 4: Configurable Rate Limiting ---');
  
  // Note: Hourly limit set to 2.
  // Alice is sent.
  // Now we dispatch Bob. Bob should be email #2 for the hour, which is allowed.
  const secondEmail = dbEmails[1];
  await sendScheduledEmail(secondEmail.id, 'mock-token', mockJob);

  const updatedSecond = await prisma.scheduledEmail.findUnique({
    where: { id: secondEmail.id },
  });
  assert(updatedSecond?.status === EmailStatus.SENT, 'Second email sent successfully (within hourly limit).');

  // Now we dispatch Charlie. Charlie should exceed the hourly limit of 2.
  // It should trigger the reschedule flow.
  const thirdEmail = dbEmails[2];
  let rescheduleMovedTriggered = false;

  const mockRateJob = {
    id: thirdEmail.id,
    moveToDelayed: async (timestamp: number, token: string) => {
      rescheduleMovedTriggered = true;
      assert(timestamp > Date.now(), 'Rescheduled timestamp is in the future.');
      assert(token === 'mock-token', 'Reschedule forwarded worker lock token.');
    },
  } as any;

  await sendScheduledEmail(thirdEmail.id, 'mock-token', mockRateJob);

  const updatedThird = await prisma.scheduledEmail.findUnique({
    where: { id: thirdEmail.id },
  });

  assert(rescheduleMovedTriggered, 'Asserted that Charlie was rescheduled via moveToDelayed call.');
  assert(updatedThird !== null, 'Asserted that Charlie was successfully retrieved from MySQL.');
  assert(updatedThird?.status === EmailStatus.SCHEDULED, 'Asserted that Charlie was reverted to SCHEDULED status in MySQL.');
  assert(updatedThird?.error?.includes('rate limit exceeded') === true, 'Asserted that reschedule error status was logged.');

  // Check that the scheduled time was advanced by 1 hour
  if (updatedThird) {
    const timeDiffMs = updatedThird.scheduledTime.getTime() - thirdEmail.scheduledTime.getTime();
    assert(timeDiffMs === 3600000, 'Verify order preservation: Charlie scheduled time advanced by exactly 1 hour.');
  }

  // ==========================================
  // VERIFY PERSISTENCE EXPLANATION
  // ==========================================
  console.log('\n==================================================');
  console.log('RESTART PERSISTENCE VERIFICATION PRINCIPLE');
  console.log('==================================================');
  console.log('1. Delayed BullMQ jobs are stored inside Redis Sorted Sets (ZSET) under:');
  console.log('   "bull:emails:delayed"');
  console.log('2. The score inside the ZSET represents the absolute Unix timestamp (in ms) when the job should run.');
  console.log('3. Since Redis is a standalone server instance container, restarting the Node/Express server');
  console.log('   does not affect the Redis memory cache at all.');
  console.log('4. When the Express server boots up again:');
  console.log('   - It initializes the BullMQ Worker class.');
  console.log('   - The worker immediately queries Redis to resume fetching pending delayed jobs.');
  console.log('   - This guarantees zero lost jobs on restarts.');
  console.log('==================================================');

  console.log('\nALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ INTEGRATION TESTING SUITE ENCOUNTERED AN ERROR:', err);
  process.exit(1);
});
