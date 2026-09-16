import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, ValidationError } from '../utils/errors.js';

vi.mock('../config/env.js', () => ({
  env: {
    PAYSTACK_PUBLIC_KEY: 'pk_test',
    PRIMARY_CLIENT_ORIGIN: 'http://localhost:5173',
    PROVIDER_ANNUAL_TRIAL_DAYS: 30,
    PROVIDER_TRIAL_DAYS: 30,
    PAYSTACK_TOKENIZATION_AMOUNT_GHS: 1,
    PAYSTACK_PROVIDER_MONTHLY_PLAN_CODE: 'PLN_month',
    PAYSTACK_PROVIDER_QUARTERLY_PLAN_CODE: undefined,
    PAYSTACK_PROVIDER_SEMIANNUAL_PLAN_CODE: undefined,
    PAYSTACK_PROVIDER_ANNUAL_PLAN_CODE: 'PLN_year',
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const initializePayment = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    authorizationUrl: 'https://checkout.paystack.com/auth',
    accessCode: 'code',
    reference: 'RR_PSUB_abc',
  }),
);
const verifyPayment = vi.hoisted(() => vi.fn());
const refundTransaction = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const createRecurringSubscription = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ subscriptionCode: 'SUB_delayed' }),
);

vi.mock('../payments/payment-provider.impl.js', () => ({
  getPaymentProvider: () => ({
    isConfigured: () => true,
    initializePayment,
    verifyPayment,
    refundTransaction,
    createRecurringSubscription,
  }),
}));

vi.mock('../repositories/mechanic.repository.js', () => ({
  mechanicRepository: { findByUserId: vi.fn() },
}));

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: { findById: vi.fn() },
}));

vi.mock('../repositories/provider-subscription.repository.js', () => ({
  providerSubscriptionRepository: {
    findByUserId: vi.fn(),
    findByMechanicId: vi.fn(),
    upsertForMechanic: vi.fn(),
    findByPaystackSubscriptionCode: vi.fn(),
    findByPaystackCustomerCode: vi.fn(),
  },
  providerSubscriptionCheckoutRepository: {
    create: vi.fn(),
    findByReference: vi.fn(),
  },
}));

import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import {
  providerSubscriptionCheckoutRepository,
  providerSubscriptionRepository,
} from '../repositories/provider-subscription.repository.js';
import {
  isProviderAccessActive,
  providerSubscriptionService,
} from '../services/provider-subscription.service.js';

describe('provider subscriptions', () => {
  const userId = '64a0000000000000000000aa';
  const mechanicId = '64a0000000000000000000bb';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue({
      _id: { toString: () => mechanicId },
    } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: userId,
      email: 'provider@example.com',
    } as never);
    vi.mocked(providerSubscriptionRepository.findByUserId).mockResolvedValue(null);
    vi.mocked(providerSubscriptionRepository.findByMechanicId).mockResolvedValue(null);
    vi.mocked(providerSubscriptionRepository.upsertForMechanic).mockImplementation(
      async (_id, data) =>
        ({
          _id: { toString: () => randomUUID() },
          ...data,
        }) as never,
    );
    initializePayment.mockResolvedValue({
      authorizationUrl: 'https://checkout.paystack.com/auth',
      accessCode: 'code',
      reference: 'RR_PSUB_abc',
    });
  });

  it('lists four provider plans with a 30-day trial on each', () => {
    const plans = providerSubscriptionService.listPlans();
    expect(plans.map((plan) => [plan.slug, plan.priceGhs, plan.equivalentMonthlyGhs, plan.trialDays])).toEqual([
      ['provider_monthly', 49.99, 49.99, 30],
      ['provider_quarterly', 129.99, 43.33, 30],
      ['provider_semiannual', 229.99, 38.33, 30],
      ['provider_annual', 429.99, 35.83, 30],
    ]);
  });

  it('starts card tokenization instead of charging the plan today', async () => {
    const result = await providerSubscriptionService.checkout(userId, 'provider_monthly');
    expect(result.trialStarted).toBe(false);
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/auth');
    expect(initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountGhs: 1,
        channels: ['card'],
        metadata: expect.objectContaining({ purpose: 'provider_card_authorization' }),
      }),
    );
  });

  it('does not treat card authorization as an active paid subscription', async () => {
    expect(
      isProviderAccessActive({
        status: 'incomplete',
      } as never),
    ).toBe(false);
    expect(
      isProviderAccessActive({
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 86_400_000),
      } as never),
    ).toBe(true);
    expect(
      isProviderAccessActive({
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      } as never),
    ).toBe(true);
  });

  it('schedules delayed Paystack billing after a reusable card authorization', async () => {
    const checkout = {
      status: 'pending',
      kind: 'card_authorization',
      user: { toString: () => userId },
      mechanic: { toString: () => mechanicId },
      planSlug: 'provider_annual',
      amountPesewas: 100,
      save: vi.fn(),
    };
    vi.mocked(providerSubscriptionCheckoutRepository.findByReference).mockResolvedValue(checkout as never);
    verifyPayment.mockResolvedValue({
      status: 'success',
      authorizationCode: 'AUTH_card',
      authorizationReusable: true,
      authorizationChannel: 'card',
      customerCode: 'CUS_1',
      amountPesewas: 100,
      currency: 'GHS',
    });

    await providerSubscriptionService.verifyCheckout(userId, 'RR_PSUB_abc');

    expect(refundTransaction).toHaveBeenCalled();
    expect(createRecurringSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        planCode: 'PLN_year',
        authorizationCode: 'AUTH_card',
        customer: 'CUS_1',
      }),
    );
    expect(providerSubscriptionRepository.upsertForMechanic).toHaveBeenCalledWith(
      mechanicId,
      expect.objectContaining({ status: 'trialing', trialUsed: true }),
    );
  });

  it('activates paid billing only after a plan-sized recurring charge', async () => {
    const existing = {
      mechanic: { toString: () => mechanicId },
      user: { toString: () => userId },
      planSlug: 'provider_monthly',
      status: 'trialing',
      save: vi.fn(),
    };
    vi.mocked(providerSubscriptionRepository.findByPaystackSubscriptionCode).mockResolvedValue(
      existing as never,
    );
    vi.mocked(providerSubscriptionRepository.findByMechanicId).mockResolvedValue(existing as never);

    await providerSubscriptionService.handleRecurringCharge({
      subscriptionCode: 'SUB_delayed',
      amountPesewas: 4999,
      paidAt: new Date().toISOString(),
    });

    expect(existing.status).toBe('active');
    expect(existing.save).toHaveBeenCalled();
  });

  it('ignores the small tokenization amount as a plan debit', async () => {
    const existing = {
      mechanic: { toString: () => mechanicId },
      user: { toString: () => userId },
      planSlug: 'provider_monthly',
      status: 'trialing',
      save: vi.fn(),
    };
    vi.mocked(providerSubscriptionRepository.findByPaystackSubscriptionCode).mockResolvedValue(
      existing as never,
    );

    await providerSubscriptionService.handleRecurringCharge({
      subscriptionCode: 'SUB_delayed',
      amountPesewas: 100,
    });

    expect(existing.status).toBe('trialing');
    expect(existing.save).not.toHaveBeenCalled();
  });

  it('blocks going online without an authorized trial or paid period', async () => {
    await expect(providerSubscriptionService.assertAccess(userId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects an unknown plan', async () => {
    await expect(providerSubscriptionService.checkout(userId, 'basic')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
