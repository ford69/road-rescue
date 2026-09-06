import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../utils/errors.js';

vi.mock('../config/env.js', () => ({
  env: {
    PAYSTACK_BASIC_PLAN_CODE: 'PLN_basic_test',
    SUBSCRIPTION_BASIC_PRICE_GHS: 49,
    PAYSTACK_CALLBACK_URL: 'http://localhost:5173/customer/subscription',
    PRIMARY_CLIENT_ORIGIN: 'http://localhost:5173',
    PAYSTACK_PUBLIC_KEY: 'pk_test',
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../payments/paystack.js', () => ({
  isPaystackConfigured: () => true,
  initializePaystackSubscription: vi.fn(),
  verifyPaystackPayment: vi.fn(),
  verifyPaystackSignature: vi.fn(),
  initializePaystackPayment: vi.fn(),
}));

vi.mock('../repositories/customer.repository.js', () => ({
  customerRepository: { findByUserId: vi.fn() },
}));

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: { findById: vi.fn() },
}));

vi.mock('../repositories/subscription.repository.js', () => ({
  subscriptionPlanRepository: { findBySlug: vi.fn(), findAll: vi.fn(), upsertPlan: vi.fn() },
  subscriptionRepository: {
    findByCustomer: vi.fn(),
    upsertForCustomer: vi.fn(),
    create: vi.fn(),
    findByPaystackSubscriptionCode: vi.fn(),
    findByLastTransactionReference: vi.fn(),
  },
  subscriptionCheckoutRepository: {
    create: vi.fn(),
    findByReference: vi.fn(),
  },
  processedPaystackEventRepository: {
    claim: vi.fn(),
  },
}));

vi.mock('../services/entitlement.service.js', () => ({
  entitlementService: {
    getCustomerEntitlements: vi.fn(),
    getMemberDiscountPercent: vi.fn(() => 8),
  },
}));

import { initializePaystackSubscription, verifyPaystackPayment } from '../payments/paystack.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import {
  processedPaystackEventRepository,
  subscriptionCheckoutRepository,
  subscriptionPlanRepository,
  subscriptionRepository,
} from '../repositories/subscription.repository.js';
import { entitlementService } from '../services/entitlement.service.js';
import { subscriptionService } from '../services/subscription.service.js';

describe('subscription billing', () => {
  const userId = '64a0000000000000000000aa';
  const customerId = '64a0000000000000000000bb';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customerRepository.findByUserId).mockResolvedValue({
      _id: { toString: () => customerId },
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: userId,
      email: 'customer@example.com',
    } as never);
    vi.mocked(subscriptionPlanRepository.findBySlug).mockResolvedValue({
      slug: 'basic',
      monthlyPriceGhs: 49,
    } as never);
    vi.mocked(subscriptionRepository.findByCustomer).mockResolvedValue({
      planSlug: 'free',
      status: 'active',
    } as never);
    vi.mocked(initializePaystackSubscription).mockResolvedValue({
      authorizationUrl: 'https://checkout.paystack.com/abc',
      accessCode: 'code',
      reference: 'RR_SUB_1',
    });
    vi.mocked(subscriptionCheckoutRepository.create).mockResolvedValue({} as never);
    vi.mocked(subscriptionRepository.upsertForCustomer).mockResolvedValue({} as never);
    vi.mocked(processedPaystackEventRepository.claim).mockResolvedValue(true);
    vi.mocked(entitlementService.getCustomerEntitlements).mockResolvedValue({
      planSlug: 'basic',
      features: [],
      status: 'active',
      allowedServiceTypes: [],
      restrictedServiceTypes: [],
    } as never);
  });

  it('rejects Premium checkout', async () => {
    await expect(subscriptionService.checkout(userId, 'premium')).rejects.toBeInstanceOf(ValidationError);
    expect(initializePaystackSubscription).not.toHaveBeenCalled();
  });

  it('initializes Basic checkout from server configuration', async () => {
    const result = await subscriptionService.checkout(userId, 'basic');
    expect(initializePaystackSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        amountGhs: 49,
        planCode: 'PLN_basic_test',
      }),
    );
    expect(result.authorizationUrl).toContain('paystack');
    expect(result.planSlug).toBe('basic');
  });

  it('activates Basic once even if the same charge is fulfilled twice', async () => {
    const checkout = {
      status: 'pending',
      amountPesewas: 4900,
      customer: { toString: () => customerId },
      providerPlanCode: 'PLN_basic_test',
      reference: 'RR_SUB_1',
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(subscriptionCheckoutRepository.findByReference).mockResolvedValue(checkout as never);

    await subscriptionService.fulfillSuccessfulCharge({
      reference: 'RR_SUB_1',
      amountPesewas: 4900,
      currency: 'GHS',
    });
    checkout.status = 'success';
    await subscriptionService.fulfillSuccessfulCharge({
      reference: 'RR_SUB_1',
      amountPesewas: 4900,
      currency: 'GHS',
    });
    expect(subscriptionRepository.upsertForCustomer).toHaveBeenCalledOnce();
  });

  it('ignores duplicate webhook event keys', async () => {
    vi.mocked(processedPaystackEventRepository.claim).mockResolvedValue(false);
    await subscriptionService.handlePaystackEvent('charge.success', {
      reference: 'RR_SUB_1',
      amount: 4900,
      currency: 'GHS',
      id: 99,
    });
    expect(subscriptionCheckoutRepository.findByReference).not.toHaveBeenCalled();
  });

  it('activates when Paystack amount differs from the catalog price', async () => {
    const checkout = {
      status: 'pending',
      amountPesewas: 4900,
      amountGhs: 49,
      customer: { toString: () => customerId },
      providerPlanCode: 'PLN_basic_test',
      reference: 'RR_SUB_1',
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(subscriptionCheckoutRepository.findByReference).mockResolvedValue(checkout as never);

    await subscriptionService.fulfillSuccessfulCharge({
      reference: 'RR_SUB_1',
      amountPesewas: 5000,
      currency: 'ghs',
    });
    expect(subscriptionRepository.upsertForCustomer).toHaveBeenCalledOnce();
    expect(checkout.amountPesewas).toBe(5000);
  });

  it('rejects charges that are not a positive GHS amount', async () => {
    vi.mocked(subscriptionCheckoutRepository.findByReference).mockResolvedValue({
      status: 'pending',
      amountPesewas: 4900,
      save: vi.fn(),
    } as never);
    await expect(
      subscriptionService.fulfillSuccessfulCharge({
        reference: 'RR_SUB_1',
        amountPesewas: 100,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(subscriptionRepository.upsertForCustomer).not.toHaveBeenCalled();
  });
});
