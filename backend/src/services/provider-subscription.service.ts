import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getPaymentProvider } from '../payments/payment-provider.impl.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import {
  providerSubscriptionCheckoutRepository,
  providerSubscriptionRepository,
} from '../repositories/provider-subscription.repository.js';
import { AuthErrorCode, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import {
  addDays,
  addMonths,
  getProviderPlan,
  isProviderPlanSlug,
  PROVIDER_PLANS,
  type ProviderPlanSlug,
} from './provider-plans.js';
import type { IProviderSubscription } from '../models/ProviderSubscription.js';
import type { VerifyPaymentResult } from '../payments/payment-provider.js';

const REFERENCE_PREFIX = 'RR_PSUB_';

function paystack() {
  return getPaymentProvider();
}

export function paystackPlanCode(slug: ProviderPlanSlug): string | undefined {
  if (slug === 'provider_monthly') return env.PAYSTACK_PROVIDER_MONTHLY_PLAN_CODE;
  if (slug === 'provider_quarterly') return env.PAYSTACK_PROVIDER_QUARTERLY_PLAN_CODE;
  if (slug === 'provider_semiannual') return env.PAYSTACK_PROVIDER_SEMIANNUAL_PLAN_CODE;
  return env.PAYSTACK_PROVIDER_ANNUAL_PLAN_CODE;
}

export function providerTrialDays(): number {
  return env.PROVIDER_TRIAL_DAYS ?? env.PROVIDER_ANNUAL_TRIAL_DAYS;
}

export function tokenizationAmountGhs(): number {
  return env.PAYSTACK_TOKENIZATION_AMOUNT_GHS;
}

function existingUserCallbackUrl(): string {
  return `${env.PRIMARY_CLIENT_ORIGIN}/mechanic/subscription`;
}

function serializeSubscription(subscription: IProviderSubscription | null) {
  if (!subscription) return null;
  const plan = getProviderPlan(subscription.planSlug);
  return {
    _id: subscription._id.toString(),
    planSlug: subscription.planSlug,
    status: subscription.status,
    trialUsed: subscription.trialUsed,
    trialEndsAt: subscription.trialEndsAt?.toISOString(),
    billingStartsAt: subscription.billingStartsAt?.toISOString(),
    currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    plan,
  };
}

async function loadMechanicContext(userId: string) {
  const mechanic = await mechanicRepository.findByUserId(userId);
  if (!mechanic) throw new NotFoundError('Provider profile not found');
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  return { mechanic, user };
}

export function isProviderAccessActive(
  subscription: IProviderSubscription | null,
  now = new Date(),
): boolean {
  if (!subscription) return false;
  if (subscription.status === 'trialing') {
    return Boolean(subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now.getTime());
  }
  if (subscription.status === 'active' || subscription.status === 'past_due') {
    if (!subscription.currentPeriodEnd) return subscription.status === 'active';
    return subscription.currentPeriodEnd.getTime() > now.getTime();
  }
  return false;
}

async function expireIfNeeded(
  subscription: IProviderSubscription | null,
): Promise<IProviderSubscription | null> {
  if (!subscription) return null;
  if (isProviderAccessActive(subscription)) return subscription;
  if (subscription.status === 'trialing' || subscription.status === 'active') {
    subscription.status = 'expired';
    await subscription.save();
  }
  return subscription;
}

function assertReusableCard(result: VerifyPaymentResult): {
  authorizationCode: string;
  customerCode: string;
} {
  if (result.status !== 'success') {
    throw new ValidationError('Card authentication has not completed successfully');
  }
  const channel = (result.authorizationChannel ?? result.channel ?? '').toLowerCase();
  if (channel && channel !== 'card') {
    throw new ValidationError('Use a debit or credit card so we can store it for later billing.');
  }
  if (!result.authorizationCode) {
    throw new ValidationError('Paystack did not return a reusable card authorization.');
  }
  if (result.authorizationReusable === false) {
    throw new ValidationError('This card cannot be reused. Try another card.');
  }
  if (!result.customerCode) {
    throw new ValidationError('Paystack did not return a customer code.');
  }
  return { authorizationCode: result.authorizationCode, customerCode: result.customerCode };
}

async function refundTokenization(reference: string): Promise<boolean> {
  try {
    await paystack().refundTransaction(
      reference,
      'Card verification / tokenization refund — no subscription payment yet',
    );
    return true;
  } catch (error) {
    logger.warn('Paystack tokenization refund failed', {
      event: 'provider.subscription.tokenization.refund.failed',
      reference,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function startAuthorizedTrial(input: {
  mechanicId: string;
  userId: string;
  planSlug: ProviderPlanSlug;
  authorizationCode: string;
  customerCode: string;
  tokenizationReference: string;
  refunded: boolean;
}): Promise<IProviderSubscription> {
  const plan = getProviderPlan(input.planSlug);
  if (!plan) throw new ValidationError('Select a provider subscription plan.');
  const now = new Date();
  const trialDays = providerTrialDays();
  const trialEndsAt = addDays(now, trialDays);
  const planCode = paystackPlanCode(input.planSlug);

  let paystackSubscriptionCode: string | undefined;
  if (planCode) {
    try {
      const created = await paystack().createRecurringSubscription({
        customer: input.customerCode,
        planCode,
        authorizationCode: input.authorizationCode,
        startDate: trialEndsAt,
      });
      paystackSubscriptionCode = created.subscriptionCode;
    } catch (error) {
      logger.error('Delayed Paystack subscription creation failed', {
        event: 'provider.subscription.schedule.failed',
        userId: input.userId,
        planSlug: input.planSlug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.warn('No Paystack plan code set; trial is local until the first scheduled charge', {
      event: 'provider.subscription.plan_code.missing',
      planSlug: input.planSlug,
    });
  }

  const subscription = await providerSubscriptionRepository.upsertForMechanic(input.mechanicId, {
    mechanic: new Types.ObjectId(input.mechanicId),
    user: new Types.ObjectId(input.userId),
    planSlug: input.planSlug,
    status: 'trialing',
    provider: 'paystack',
    providerPlanCode: planCode,
    paystackAuthorizationCode: input.authorizationCode,
    paystackCustomerCode: input.customerCode,
    paystackSubscriptionCode,
    lastTransactionReference: input.tokenizationReference,
    trialUsed: true,
    trialEndsAt,
    billingStartsAt: trialEndsAt,
    cardAuthorizedAt: now,
    tokenizationRefunded: input.refunded,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    cancelledAt: undefined,
  });

  logger.info('Provider card authorized; subscription billing delayed until trial ends', {
    event: 'provider.subscription.authorized',
    userId: input.userId,
    planSlug: input.planSlug,
    billingStartsAt: trialEndsAt.toISOString(),
    paystackSubscriptionCode,
  });
  return subscription;
}

export const providerSubscriptionService = {
  listPlans() {
    const trialDays = providerTrialDays();
    return PROVIDER_PLANS.map((plan) => ({
      ...plan,
      trialDays,
      currency: 'GHS' as const,
    }));
  },

  async getCurrent(userId: string) {
    await loadMechanicContext(userId);
    const raw = await providerSubscriptionRepository.findByUserId(userId);
    const subscription = await expireIfNeeded(raw);
    return {
      subscription: serializeSubscription(subscription),
      plans: this.listPlans(),
      hasActiveSubscription: isProviderAccessActive(subscription),
      paystackConfigured: paystack().isConfigured(),
    };
  },

  async hasAccess(userId: string): Promise<boolean> {
    const raw = await providerSubscriptionRepository.findByUserId(userId);
    const subscription = await expireIfNeeded(raw);
    return isProviderAccessActive(subscription);
  },

  async assertAccess(userId: string): Promise<void> {
    if (await this.hasAccess(userId)) return;
    throw new ForbiddenError(
      'An authorized provider plan is required to go online and accept jobs.',
      AuthErrorCode.SUBSCRIPTION_REQUIRED,
    );
  },

  async checkout(userId: string, requestedPlan?: string) {
    if (!isProviderPlanSlug(requestedPlan)) {
      throw new ValidationError('Select a provider subscription plan.');
    }
    const plan = getProviderPlan(requestedPlan);
    if (!plan) throw new ValidationError('Select a provider subscription plan.');
    const { mechanic, user } = await loadMechanicContext(userId);
    const existing = await expireIfNeeded(
      await providerSubscriptionRepository.findByMechanicId(mechanic._id.toString()),
    );

    if (existing?.paystackAuthorizationCode && isProviderAccessActive(existing)) {
      throw new ValidationError('Your selected plan is already authorized. No payment is due today.');
    }

    if (!paystack().isConfigured()) {
      throw new ValidationError('Paystack is not configured for provider subscriptions yet.');
    }

    const amountGhs = tokenizationAmountGhs();
    const reference = `${REFERENCE_PREFIX}${crypto.randomBytes(8).toString('hex')}`;
    const planCode = paystackPlanCode(plan.slug);
    const initialized = await paystack().initializePayment({
      email: user.email,
      amountGhs,
      reference,
      callbackUrl: existingUserCallbackUrl(),
      metadata: {
        purpose: 'provider_card_authorization',
        planSlug: plan.slug,
        userId,
        mechanicId: mechanic._id.toString(),
      },
      platformFeePercent: 0,
      channels: ['card'],
    });

    await providerSubscriptionCheckoutRepository.create({
      mechanic: mechanic._id,
      user: user._id,
      planSlug: plan.slug,
      provider: 'paystack',
      kind: 'card_authorization',
      providerPlanCode: planCode ?? 'none',
      reference: initialized.reference,
      amountGhs,
      amountPesewas: Math.round(amountGhs * 100),
      currency: 'GHS',
      status: 'pending',
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
    });

    if (!existing) {
      await providerSubscriptionRepository.upsertForMechanic(mechanic._id.toString(), {
        mechanic: mechanic._id,
        user: user._id,
        planSlug: plan.slug,
        status: 'incomplete',
        provider: 'paystack',
        providerPlanCode: planCode,
        lastTransactionReference: initialized.reference,
        trialUsed: false,
      });
    }

    return {
      trialStarted: false,
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
      accessCode: initialized.accessCode,
      publicKey: env.PAYSTACK_PUBLIC_KEY,
      callbackUrl: existingUserCallbackUrl(),
      planSlug: plan.slug,
      hasActiveSubscription: isProviderAccessActive(existing),
    };
  },

  async verifyCheckout(userId: string, reference: string) {
    const checkout = await providerSubscriptionCheckoutRepository.findByReference(reference);
    if (!checkout) throw new NotFoundError('Card verification not found');
    if (checkout.user.toString() !== userId) {
      throw new NotFoundError('Card verification not found');
    }
    if (checkout.status === 'success') {
      return this.getCurrent(userId);
    }

    const result = await paystack().verifyPayment(reference);
    await this.fulfillCardAuthorization({
      reference,
      verification: result,
    });
    return this.getCurrent(userId);
  },

  async fulfillCardAuthorization(input: {
    reference: string;
    verification?: VerifyPaymentResult;
    amountPesewas?: number;
    currency?: string;
    paidAt?: string;
    customerCode?: string;
    providerEventId?: string;
  }) {
    const checkout = await providerSubscriptionCheckoutRepository.findByReference(input.reference);
    if (!checkout) {
      logger.info('Ignoring unknown provider Paystack charge', {
        event: 'provider.subscription.payment.ignored',
        reference: input.reference,
      });
      return null;
    }
    if (checkout.status === 'success') return checkout;
    if (checkout.kind === 'subscription_charge') {
      return this.activatePaidPeriod(checkout.mechanic.toString(), {
        paidAt: input.paidAt,
        subscriptionCode: undefined,
        customerCode: input.customerCode,
        reference: input.reference,
      });
    }

    const result =
      input.verification ??
      ({
        status: 'success',
        reference: input.reference,
        amountPesewas: input.amountPesewas ?? checkout.amountPesewas,
        currency: input.currency ?? 'GHS',
        paid_at: input.paidAt,
        customerCode: input.customerCode,
      } satisfies VerifyPaymentResult);

    let authorizationCode = result.authorizationCode ?? '';
    let customerCode = result.customerCode ?? input.customerCode ?? '';
    if (input.verification) {
      const resolved = assertReusableCard(result);
      authorizationCode = resolved.authorizationCode;
      customerCode = resolved.customerCode;
    } else if (!authorizationCode || !customerCode) {
      const verified = await paystack().verifyPayment(input.reference);
      const resolved = assertReusableCard(verified);
      authorizationCode = resolved.authorizationCode;
      customerCode = resolved.customerCode;
    }

    const refunded = await refundTokenization(input.reference);
    checkout.status = 'success';
    checkout.fulfilledAt = input.paidAt ? new Date(input.paidAt) : new Date();
    checkout.providerEventId = input.providerEventId;
    await checkout.save();

    await startAuthorizedTrial({
      mechanicId: checkout.mechanic.toString(),
      userId: checkout.user.toString(),
      planSlug: checkout.planSlug,
      authorizationCode,
      customerCode,
      tokenizationReference: input.reference,
      refunded,
    });
    return checkout;
  },

  async activatePaidPeriod(
    mechanicId: string,
    input: {
      paidAt?: string;
      subscriptionCode?: string;
      customerCode?: string;
      reference?: string;
    },
  ) {
    const existing = await providerSubscriptionRepository.findByMechanicId(mechanicId);
    if (!existing) return null;
    const plan = getProviderPlan(existing.planSlug);
    const now = input.paidAt ? new Date(input.paidAt) : new Date();
    const periodEnd = addMonths(now, plan?.intervalMonths ?? 1);
    existing.status = 'active';
    existing.currentPeriodStart = now;
    existing.currentPeriodEnd = periodEnd;
    if (input.subscriptionCode) existing.paystackSubscriptionCode = input.subscriptionCode;
    if (input.customerCode) existing.paystackCustomerCode = input.customerCode;
    if (input.reference) existing.lastTransactionReference = input.reference;
    await existing.save();
    logger.info('Provider subscription billing started after trial', {
      event: 'provider.subscription.activated',
      userId: existing.user.toString(),
      planSlug: existing.planSlug,
    });
    return existing;
  },

  async handleRecurringCharge(input: {
    subscriptionCode?: string;
    customerCode?: string;
    reference?: string;
    paidAt?: string;
    amountPesewas: number;
  }) {
    let subscription = input.subscriptionCode
      ? await providerSubscriptionRepository.findByPaystackSubscriptionCode(input.subscriptionCode)
      : null;
    if (!subscription && input.customerCode) {
      subscription = await providerSubscriptionRepository.findByPaystackCustomerCode(
        input.customerCode,
      );
    }
    if (!subscription) return null;
    const plan = getProviderPlan(subscription.planSlug);
    const expected = Math.round((plan?.priceGhs ?? 0) * 100);
    if (expected > 0 && input.amountPesewas < expected * 0.9) {
      logger.info('Ignoring small provider charge that is not a plan debit', {
        event: 'provider.subscription.charge.ignored',
        amountPesewas: input.amountPesewas,
        expectedPesewas: expected,
      });
      return subscription;
    }
    return this.activatePaidPeriod(subscription.mechanic.toString(), {
      paidAt: input.paidAt,
      subscriptionCode: input.subscriptionCode,
      customerCode: input.customerCode,
      reference: input.reference,
    });
  },

  async attachPaystackSubscriptionCode(code: string, customerCode?: string) {
    const existing =
      (await providerSubscriptionRepository.findByPaystackSubscriptionCode(code)) ??
      (customerCode
        ? await providerSubscriptionRepository.findByPaystackCustomerCode(customerCode)
        : null);
    if (!existing) return null;
    existing.paystackSubscriptionCode = code;
    if (customerCode) existing.paystackCustomerCode = customerCode;
    await existing.save();
    return existing;
  },
};

export function isProviderSubscriptionReference(reference?: string): reference is string {
  return Boolean(reference && reference.startsWith(REFERENCE_PREFIX));
}
