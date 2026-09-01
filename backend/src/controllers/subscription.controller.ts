import type { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { SubscriptionPlanSlug } from '../types/index.js';

export const subscriptionController = {
  listPlans: async (_req: Request, res: Response) => {
    const data = await subscriptionService.listPlans();
    return sendSuccess(res, data);
  },

  current: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await subscriptionService.getCurrent(req.user.id);
    return sendSuccess(res, data);
  },

  initializeUpgrade: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const planSlug = req.body?.planSlug as SubscriptionPlanSlug;
    const data = await subscriptionService.initializeUpgrade(req.user.id, planSlug);
    return sendSuccess(res, data, 'Subscription upgrade initialized');
  },

  downgradeToFree: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await subscriptionService.downgradeToFree(req.user.id);
    return sendSuccess(res, data, 'Moved to Free plan');
  },
};
