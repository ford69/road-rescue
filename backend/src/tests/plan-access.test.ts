import { describe, expect, it } from 'vitest';
import {
  allowedServicesForPlan,
  isPaidCustomerPlan,
  planAllowsService,
} from '../services/plan-access.js';

describe('plan service access', () => {
  it('allows Basic included services for an active Basic subscription', () => {
    expect(planAllowsService('basic', 'active', 'battery')).toBe(true);
    expect(planAllowsService('basic', 'active', 'flat-tire')).toBe(true);
    expect(planAllowsService('basic', 'active', 'lockout')).toBe(true);
    expect(planAllowsService('basic', 'active', 'other')).toBe(true);
    expect(planAllowsService('basic', 'active', 'towing')).toBe(true);
  });

  it('rejects fuel and accident for Basic subscribers', () => {
    expect(planAllowsService('basic', 'active', 'fuel')).toBe(false);
    expect(planAllowsService('basic', 'active', 'accident')).toBe(false);
  });

  it('rejects premium-only services when the subscription is expired or cancelled', () => {
    expect(planAllowsService('premium', 'expired', 'fuel')).toBe(false);
    expect(planAllowsService('premium', 'cancelled', 'fuel')).toBe(false);
    expect(planAllowsService('basic', 'expired', 'accident')).toBe(false);
  });

  it('allows premium-only services only for an active Premium subscription', () => {
    expect(planAllowsService('premium', 'active', 'fuel')).toBe(true);
    expect(planAllowsService('premium', 'active', 'accident')).toBe(true);
    expect(allowedServicesForPlan('premium', 'active')).toEqual(
      expect.arrayContaining(['towing', 'fuel', 'accident', 'battery']),
    );
  });

  it('treats active Basic, Premium, and legacy Free records as dashboard-eligible', () => {
    expect(isPaidCustomerPlan('free', 'active')).toBe(true);
    expect(isPaidCustomerPlan('basic', 'incomplete')).toBe(false);
    expect(isPaidCustomerPlan('basic', 'active')).toBe(true);
    expect(isPaidCustomerPlan('basic', 'non_renewing')).toBe(true);
  });
});
