import type { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
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
    const planSlug = req.body?.planSlug as SubscriptionPlanSlug | undefined;
    const data = await subscriptionService.checkout(req.user.id, planSlug);
    return sendSuccess(res, data, 'Subscription checkout initialized');
  },

  checkout: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const planSlug = req.body?.planSlug as SubscriptionPlanSlug | undefined;
    const data = await subscriptionService.checkout(req.user.id, planSlug);
    return sendSuccess(res, data, 'Subscription checkout initialized');
  },

  verify: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const reference = req.params.reference;
    if (typeof reference !== 'string' || !reference) {
      throw new ValidationError('Payment reference is required');
    }
    const data = await subscriptionService.verifyCheckout(req.user.id, reference);
    return sendSuccess(res, data, 'Subscription payment verified');
  },

  downgradeToFree: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await subscriptionService.downgradeToFree(req.user.id);
    return sendSuccess(res, data, 'Moved to Free plan');
  },
};
