import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserPayload } from '../types/express.js';
import { prisma } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    
    // Verify the user exists in the database
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!userExists) {
      return res.status(401).json({
        error: 'UnauthorizedError',
        message: 'Invalid user session. The user record no longer exists.',
      });
    }

    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'UnauthorizedError',
      message: 'Invalid or expired session token.',
    });
  }
};
