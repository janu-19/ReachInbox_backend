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
const PORT = process.env.PORT || 5000;

logger.info(`Server environment (NODE_ENV) resolved as: ${process.env.NODE_ENV}`);

app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount modular API routers
app.use('/api', apiRouter);

// Global error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Express server running on port ${PORT}`);
});
