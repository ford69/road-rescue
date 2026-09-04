import type { NextFunction, Request, Response } from 'express';
import { userRepository } from '../repositories/user.repository.js';
import { AuthErrorCode, ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Loads the current user from the database and requires emailVerified.
 * JWT claims are not used for this check so a stale token cannot bypass verification.
 */
export async function requireEmailVerification(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!user.emailVerified) {
      next(
        new ForbiddenError(
          'Please verify your email address before accessing Road Rescue.',
          AuthErrorCode.EMAIL_NOT_VERIFIED,
        ),
      );
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
