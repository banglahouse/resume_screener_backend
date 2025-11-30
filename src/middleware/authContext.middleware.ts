import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { AppError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export interface AuthUser {
  id: string;
  externalId: string;
  role: 'recruiter' | 'candidate';
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

export const authContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const headerExternalId = req.headers['x-user-id'] as string | undefined;
    const headerRole = req.headers['x-user-role'] as string | undefined;

    // Allow anonymous access by defaulting missing/invalid headers
    const externalId = headerExternalId || 'public-client';
    const role: AuthUser['role'] = headerRole === 'candidate' || headerRole === 'recruiter'
      ? (headerRole as AuthUser['role'])
      : 'recruiter';

    const userRepository = AppDataSource.getRepository(User);

    // Upsert user
    let user = await userRepository.findOne({ where: { externalId } });
    
    if (!user) {
      user = userRepository.create({
        externalId,
        role
      });
      await userRepository.save(user);
      logger.info('Created new user', { externalId, role });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      externalId: user.externalId,
      role: user.role
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Auth context error', error);
      next(new AppError('Authentication failed', 500));
    }
  }
};
