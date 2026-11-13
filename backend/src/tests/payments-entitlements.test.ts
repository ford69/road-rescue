import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculatePaymentSplit } from '../payments/payment-provider.impl.js';
import { entitlementService } from '../services/entitlement.service.js';
import { isJobPaymentReference, isPaymentAvailable } from '../services/payment.service.js';
import { commissionPesewas, ghsToPesewas } from '../utils/money.js';

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

  it('uses integer pesewas for the 10% job commission', () => {
    const gross = ghsToPesewas(200);
    const fee = commissionPesewas(gross, 10);
    expect(fee).toBe(2_000);
    expect(gross - fee).toBe(18_000);
  });
});

describe('subscription entitlements', () => {
  it('returns plan-specific features centrally', () => {
    expect(entitlementService.getEntitlementsForPlan('free')).toEqual([
      'mechanic_discovery',
      'mechanic_profile',
      'mechanic_reviews',
      'service_upload',
    ]);
    expect(entitlementService.getEntitlementsForPlan('basic')).toContain('member_discount');
    expect(entitlementService.getEntitlementsForPlan('premium')).toContain('premium_support');
  });

  it('returns member discount percentages by plan', () => {
    expect(entitlementService.getMemberDiscountPercent('free')).toBe(0);
    expect(entitlementService.getMemberDiscountPercent('basic')).toBe(8);
    expect(entitlementService.getMemberDiscountPercent('premium')).toBe(15);
  });
});

describe('job payment eligibility', () => {
  it('allows Paystack checkout after the customer confirms completion', () => {
    expect(isPaymentAvailable('awaiting_confirmation')).toBe(false);
    expect(isPaymentAvailable('issue_reported')).toBe(false);
    expect(isPaymentAvailable('completed')).toBe(true);
  });

  it('identifies in-app job payment references', () => {
    expect(isJobPaymentReference('RR_JOB_abc')).toBe(true);
    expect(isJobPaymentReference('RR_PWAL_abc')).toBe(false);
  });
});
