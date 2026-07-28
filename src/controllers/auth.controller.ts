import { Request, Response, NextFunction } from 'express';
import { verifyGoogleToken, generateSessionToken } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'idToken is required.',
      });
    }

    const user = await verifyGoogleToken(idToken);
    const token = generateSessionToken(user.id, user.email);

    logger.info(`User ${user.email} logged in successfully.`);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    return next(error);
  }
};
