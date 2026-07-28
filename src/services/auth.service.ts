import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

// Initialize Client only if Google Client ID is configured to prevent start errors
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export const verifyGoogleToken = async (idToken: string) => {
  // Developer Mock authentication bypass (for easy localhost API testing)
  if (idToken.startsWith('mock_')) {
    const mockEmail = `${idToken.substring(5)}@example.com`;
    logger.warn(`Mock Google login bypass triggered for: ${mockEmail}`);

    const user = await prisma.user.upsert({
      where: { email: mockEmail },
      update: {},
      create: {
        email: mockEmail,
        name: mockEmail.split('@')[0],
        picture: 'https://lh3.googleusercontent.com/a/default-user',
      },
    });

    return user;
  }

  if (!client) {
    throw new Error('Google Client ID is not configured. Setup GOOGLE_CLIENT_ID in your environment.');
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Token does not contain user email information.');
    }

    const { email, name, picture } = payload;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, picture },
      create: { email, name, picture },
    });

    return user;
  } catch (error) {
    logger.error('Failed verifying Google OAuth token', error);
    throw error;
  }
};

export const generateSessionToken = (userId: string, email: string): string => {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
};
