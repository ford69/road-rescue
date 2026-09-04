import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AuthErrorCode } from '../utils/errors.js';

const skipInTests = () => env.NODE_ENV === 'test';

function jsonHandler(code: string, message: string) {
  return (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      code,
      message,
      requestId: req.requestId,
    });
  };
}

function emailKey(req: Request): string {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${req.ip ?? 'unknown'}:${email}`;
}

export const resendVerificationMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  validate: false,
  handler: jsonHandler(
    AuthErrorCode.VERIFICATION_EMAIL_RATE_LIMITED,
    'Please wait before requesting another verification email.',
  ),
});

export const resendVerificationHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  validate: false,
  handler: jsonHandler(
    AuthErrorCode.VERIFICATION_EMAIL_RATE_LIMITED,
    'Too many verification emails requested. Try again later.',
  ),
});

export const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: jsonHandler(
    AuthErrorCode.VERIFICATION_TOKEN_INVALID,
    'Too many verification attempts. Try again later.',
  ),
});
