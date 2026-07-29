import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

dotenv.config();

// Global process exception safety handlers
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection caught at process level:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception caught at process level:', err);
});

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

logger.info(`Server environment (NODE_ENV) resolved as: ${process.env.NODE_ENV}`);
logger.info(`REDIS_URL configured in environment: ${Boolean(process.env.REDIS_URL)}`);

// Permissive CORS middleware for cross-origin frontend requests & Railway probes
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

app.use(express.json());

// Universal health check routes for Railway and monitoring
app.get(['/', '/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ReachInbox Backend Service API',
    version: '1.0.4',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routers
app.use('/api', apiRouter);

// Global error handling middleware
app.use(errorHandler);

// Bind Express server to primary PORT and common Railway target ports (5001, 8080, 3000, 80)
const portsToListen = Array.from(new Set([PORT, 5001, 8080, 3000, 80]));

portsToListen.forEach((p, idx) => {
  try {
    const srv = app.listen(p, '0.0.0.0', () => {
      logger.info(`Express server actively listening on 0.0.0.0:${p}`);
      
      // On primary server startup, trigger deferred background worker loading
      if (idx === 0) {
        setImmediate(async () => {
          logger.info('Attempting to initialize background email worker module...');
          try {
            await import('./workers/email.worker.js');
            logger.info('Email worker module loaded successfully.');
          } catch (err) {
            logger.error('Email worker module import failed (REST API remains operational):', err);
          }

          try {
            await import('./queue/email.events.js');
            logger.info('Queue events module loaded successfully.');
          } catch (err) {
            logger.error('Queue events module import failed (REST API remains operational):', err);
          }

          try {
            const { recoverPendingEmails } = await import('./services/recovery.service.js');
            await recoverPendingEmails();
          } catch (err) {
            logger.error('Email recovery service execution failed:', err);
          }
        });
      }
    });

    srv.on('error', (err: any) => {
      if (err.code !== 'EADDRINUSE') {
        logger.warn(`Port ${p} listener notice: ${err.message}`);
      }
    });
  } catch (err) {
    // Ignore duplicate binding errors
  }
});

export default app;
