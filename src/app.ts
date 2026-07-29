import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Initialize background queue worker and events monitoring
import './workers/email.worker.js';
import './queue/email.events.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

logger.info(`Server environment (NODE_ENV) resolved as: ${process.env.NODE_ENV}`);

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
    version: '1.0.2',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routers
app.use('/api', apiRouter);

// Global error handling middleware
app.use(errorHandler);

// Listen on all network interfaces (IPv4 & IPv6 dual-stack)
app.listen(PORT, () => {
  logger.info(`Express server running on port ${PORT}`);
});
