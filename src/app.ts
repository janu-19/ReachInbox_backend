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
const PORT = process.env.PORT || 5001;

logger.info(`Server environment (NODE_ENV) resolved as: ${process.env.NODE_ENV}`);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://reachinbox-frontend-6ckk.onrender.com'
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: 'v1.0.1-bypass-timeout', timestamp: new Date().toISOString() });
});

// Mount modular API routers
app.use('/api', apiRouter);

// Global error handling middleware
app.use(errorHandler);

app.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`Express server running on port ${PORT}`);
});
