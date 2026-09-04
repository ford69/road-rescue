import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthErrorCode, ForbiddenError } from '../utils/errors.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { entitlementService } from '../services/entitlement.service.js';

vi.mock('../repositories/customer.repository.js', () => ({
  customerRepository: { findByUserId: vi.fn() },
}));

vi.mock('../repositories/subscription.repository.js', () => ({
  subscriptionRepository: { findByCustomer: vi.fn() },
  subscriptionPlanRepository: {},
}));

describe('entitlementService.assertServiceAllowed', () => {
  beforeEach(() => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue({
      _id: { toString: () => '64a0000000000000000000c1' },
    } as never);
    vi.mocked(subscriptionRepository.findByCustomer).mockResolvedValue({
      planSlug: 'basic',
      status: 'active',
    } as never);
  });

  it('allows a Basic included service', async () => {
    await expect(entitlementService.assertServiceAllowed('user-1', 'battery')).resolves.toBeUndefined();
  });

  it('rejects towing with PLAN_FEATURE_NOT_AVAILABLE', async () => {
    await expect(entitlementService.assertServiceAllowed('user-1', 'towing')).rejects.toMatchObject({
      statusCode: 403,
      code: AuthErrorCode.PLAN_FEATURE_NOT_AVAILABLE,
    });
  });

  it('rejects fuel with PLAN_FEATURE_NOT_AVAILABLE', async () => {
    const error = await entitlementService.assertServiceAllowed('user-1', 'fuel').catch((err) => err);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.code).toBe(AuthErrorCode.PLAN_FEATURE_NOT_AVAILABLE);
  });

  it('rejects accident services with PLAN_FEATURE_NOT_AVAILABLE', async () => {
    await expect(entitlementService.assertServiceAllowed('user-1', 'accident')).rejects.toMatchObject({
      code: AuthErrorCode.PLAN_FEATURE_NOT_AVAILABLE,
    });
  });
});
