import type { NextFunction, Request, Response } from 'express';
import { AuthErrorCode, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { entitlementService } from '../services/entitlement.service.js';
import { isPaidCustomerPlan } from '../services/plan-access.js';

/**
 * Customers must have an active Basic (free) or Premium plan to use product APIs.
 * Providers and admins are not gated.
 */
export async function requireCustomerSubscription(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }
  if (req.user.role !== 'customer') {
    next();
    return;
  }

  try {
    const entitlements = await entitlementService.getCustomerEntitlements(req.user.id);
    if (isPaidCustomerPlan(entitlements.planSlug, entitlements.status)) {
      next();
      return;
    }
    next(
      new ForbiddenError(
        'An active Basic plan is required to use Road Rescue.',
        AuthErrorCode.SUBSCRIPTION_REQUIRED,
      ),
    );
  } catch (error) {
    next(error);
  }
}
