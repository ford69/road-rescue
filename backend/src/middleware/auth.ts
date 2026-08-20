import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/tokens.js';
import type { Role } from '../types/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = bearer ?? req.cookies?.accessToken;

  if (!token) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = bearer ?? req.cookies?.accessToken;

  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    // Guest continues without auth
  }
  next();
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('You do not have permission to access this resource'));
      return;
    }
    next();
  };
}

export function guestOnly(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = bearer ?? req.cookies?.accessToken;

  if (token) {
    try {
      verifyAccessToken(token);
      next(new ForbiddenError('Already authenticated'));
      return;
    } catch {
      next();
      return;
    }
  }
  next();
}
