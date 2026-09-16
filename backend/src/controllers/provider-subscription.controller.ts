import type { Request, Response } from 'express';
import { providerSubscriptionService } from '../services/provider-subscription.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

export const providerSubscriptionController = {
  listPlans: async (_req: Request, res: Response) => {
    const data = providerSubscriptionService.listPlans();
    return sendSuccess(res, data);
  },

  current: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await providerSubscriptionService.getCurrent(req.user.id);
    return sendSuccess(res, data);
  },

  checkout: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const planSlug = typeof req.body?.planSlug === 'string' ? req.body.planSlug : undefined;
    const data = await providerSubscriptionService.checkout(req.user.id, planSlug);
    return sendSuccess(
      res,
      data,
      'Authenticate your card. Your plan is billed after the trial, not today.',
    );
  },

  verify: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const reference = req.params.reference;
    if (typeof reference !== 'string' || !reference) {
      throw new ValidationError('Payment reference is required');
    }
    const data = await providerSubscriptionService.verifyCheckout(req.user.id, reference);
    return sendSuccess(res, data, 'Subscription payment verified');
  },
};
