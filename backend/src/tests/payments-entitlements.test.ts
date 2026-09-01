import { describe, expect, it } from 'vitest';
import { calculatePaymentSplit } from '../payments/payment-provider.impl.js';
import { entitlementService } from '../services/entitlement.service.js';

describe('payment split', () => {
  it('calculates platform and provider amounts without holding a wallet balance', () => {
    const split = calculatePaymentSplit({
      grossAmountGhs: 200,
      platformFeePercent: 15,
    });
    expect(split.grossAmount).toBe(200);
    expect(split.platformFee).toBe(30);
    expect(split.providerAmount).toBe(170);
  });
});

describe('subscription entitlements', () => {
  it('returns plan-specific features centrally', () => {
    expect(entitlementService.getEntitlementsForPlan('free')).toEqual([]);
    expect(entitlementService.getEntitlementsForPlan('basic')).toContain('member_discount');
    expect(entitlementService.getEntitlementsForPlan('premium')).toContain('premium_support');
  });

  it('returns member discount percentages by plan', () => {
    expect(entitlementService.getMemberDiscountPercent('free')).toBe(0);
    expect(entitlementService.getMemberDiscountPercent('basic')).toBe(8);
    expect(entitlementService.getMemberDiscountPercent('premium')).toBe(15);
  });
});
