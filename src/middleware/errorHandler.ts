import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  name: string;
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`${req.method} ${req.path} failed`, err);

  // Prisma unique constraint error
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'ConflictError',
      message: 'A unique constraint was violated. Duplicate record exists.',
    });
  }

  // Google Auth or JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Invalid authorization token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Session has expired, please log in again.',
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected server error occurred.';
  const name = err.name || 'InternalServerError';

  res.status(statusCode).json({
    error: name,
    message: message,
  });
};
