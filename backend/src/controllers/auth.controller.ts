import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';

export const authController = {
  registerCustomer: async (req: Request, res: Response) => {
    const data = await authService.registerCustomer(req.body, res);
    return sendSuccess(res, data, 'Customer registered', 201);
  },

  registerMechanic: async (req: Request, res: Response) => {
    const data = await authService.registerMechanic(req.body, req.file, res);
    return sendSuccess(res, data, 'Mechanic registered', 201);
  },

  createAdmin: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await authService.createAdmin(req.body, req.user.role);
    return sendSuccess(res, data, 'Admin created', 201);
  },

  login: async (req: Request, res: Response) => {
    const data = await authService.login(req.body, res);
    return sendSuccess(res, data, 'Logged in');
  },

  logout: async (req: Request, res: Response) => {
    const data = await authService.logout(req.user?.id, res);
    return sendSuccess(res, data, 'Logged out');
  },

  refresh: async (req: Request, res: Response) => {
    const token = (req.body?.refreshToken as string | undefined) ?? req.cookies?.refreshToken;
    const data = await authService.refresh(token, res);
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
    const data = await authService.verifyEmail(req.body.token);
    return sendSuccess(res, data, data.message);
  },

  me: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await authService.me(req.user.id);
    return sendSuccess(res, data);
  },
};
