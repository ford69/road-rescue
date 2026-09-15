import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export const authController = {
  registerCustomer: async (req: Request, res: Response) => {
    logger.info('auth.registration.started', {
      event: 'auth.registration.started',
      requestId: req.requestId,
      role: 'customer',
    });
    const data = await authService.registerCustomer(req.body, res);
    return sendSuccess(res, data, 'Please verify your email address before continuing.', 201);
  },

  registerMechanic: async (req: Request, res: Response) => {
    logger.info('auth.registration.started', {
      event: 'auth.registration.started',
      requestId: req.requestId,
      role: 'mechanic',
      origin: req.get('origin'),
      userAgent: req.get('user-agent'),
      authenticated: Boolean(req.user),
    });
    const data = await authService.registerMechanic(req.body, req.file, res);
    return sendSuccess(res, data, 'Please verify your email address before continuing.', 201);
  },

  createAdmin: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await authService.createAdmin(req.body, req.user.role);
    return sendSuccess(res, data, 'Admin created', 201);
  },

  login: async (req: Request, res: Response) => {
    logger.info('auth.login.started', { event: 'auth.login.started', requestId: req.requestId });
    const data = await authService.login(req.body, res);
    return sendSuccess(res, data, 'Logged in');
  },

  loginAdmin: async (req: Request, res: Response) => {
    const data = await authService.loginAdmin(req.body, res);
    return sendSuccess(res, data, 'Logged in');
  },

  logout: async (req: Request, res: Response) => {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    const hasAccessCookie = Boolean(req.cookies?.accessToken);
    logger.info('auth.logout.attempt', {
      event: 'auth.logout.attempt',
      requestId: req.requestId,
      authenticated: Boolean(req.user),
      userId: req.user?.id,
      hasBearer,
      hasAccessCookie,
      origin: req.get('origin'),
      userAgent: req.get('user-agent'),
    });
    const data = await authService.logout(req.user?.id, res, req.requestId);
    return sendSuccess(res, data, 'Logged out');
  },

  refresh: async (req: Request, res: Response) => {
    const token = (req.body?.refreshToken as string | undefined) ?? req.cookies?.refreshToken;
    const data = await authService.refresh(token, res, req.requestId);
    return sendSuccess(res, data, 'Token refreshed');
  },

  forgotPassword: async (req: Request, res: Response) => {
    const data = await authService.forgotPassword(req.body.email);
    return sendSuccess(res, data, data.message);
  },

  resetPassword: async (req: Request, res: Response) => {
    const data = await authService.resetPassword(req.body);
    return sendSuccess(res, data, data.message);
  },

  verifyEmail: async (req: Request, res: Response) => {
    const data = await authService.verifyEmail(req.body.token, res);
    return sendSuccess(res, data, data.message);
  },

  resendVerification: async (req: Request, res: Response) => {
    const data = await authService.resendVerification(req.body.email);
    return sendSuccess(res, data, data.message);
  },

  me: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await authService.me(req.user.id);
    return sendSuccess(res, data);
  },
};
