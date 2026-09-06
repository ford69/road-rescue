import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AuthErrorCode, ForbiddenError } from '../utils/errors.js';
import { entitlementService } from '../services/entitlement.service.js';
import { requireCustomerSubscription } from '../middleware/requireCustomerSubscription.js';

vi.mock('../services/entitlement.service.js', () => ({
  entitlementService: { getCustomerEntitlements: vi.fn() },
}));

describe('requireCustomerSubscription', () => {
  const res = {} as Response;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows mechanics through without a customer subscription', async () => {
    const next = vi.fn() as NextFunction;
    const req = { user: { id: 'm1', role: 'mechanic', email: 'm@x.gh' } } as Request;
    await requireCustomerSubscription(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(entitlementService.getCustomerEntitlements).not.toHaveBeenCalled();
  });

  it('blocks customers without an active Basic plan', async () => {
    vi.mocked(entitlementService.getCustomerEntitlements).mockResolvedValue({
      planSlug: 'free',
      status: 'active',
      features: [],
      allowedServiceTypes: [],
      restrictedServiceTypes: [],
    } as never);
    const next = vi.fn() as NextFunction;
    const req = { user: { id: 'c1', role: 'customer', email: 'c@x.gh' } } as Request;
    await requireCustomerSubscription(req, res, next);
    const error = vi.mocked(next).mock.calls[0][0] as ForbiddenError;
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.code).toBe(AuthErrorCode.SUBSCRIPTION_REQUIRED);
  });

  it('allows customers with an active Basic plan', async () => {
    vi.mocked(entitlementService.getCustomerEntitlements).mockResolvedValue({
      planSlug: 'basic',
      status: 'active',
      features: [],
      allowedServiceTypes: [],
      restrictedServiceTypes: [],
    } as never);
    const next = vi.fn() as NextFunction;
    const req = { user: { id: 'c1', role: 'customer', email: 'c@x.gh' } } as Request;
    await requireCustomerSubscription(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
