import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { customerRepository } from '../repositories/customer.repository.js';
import {
  processedPaystackEventRepository,
  subscriptionCheckoutRepository,
  subscriptionPlanRepository,
  subscriptionRepository,
} from '../repositories/subscription.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import {
  initializePaystackSubscription,
  isPaystackConfigured,
  verifyPaystackPayment,
} from '../payments/paystack.js';
import { entitlementService } from './entitlement.service.js';
import { ApiError, ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import type { SubscriptionPlanSlug, SubscriptionStatus } from '../types/index.js';

const BASIC_PLAN: SubscriptionPlanSlug = 'basic';

function frontendSubscriptionReturnUrl(): string {
  const fallback = `${env.PRIMARY_CLIENT_ORIGIN}/auth/complete-subscription`;
  const configured = env.PAYSTACK_CALLBACK_URL;
  if (!configured) return fallback;
  try {
    const url = new URL(configured);
    if (url.pathname.includes('/api/')) return fallback;
    return configured;
  } catch {
    return fallback;
  }
}

function subscriptionCallbackUrl(): string {
  return frontendSubscriptionReturnUrl();
}

function basicPlanCode(): string {
  return env.PAYSTACK_BASIC_PLAN_CODE ?? '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function metadataPurpose(data: Record<string, unknown>): string | undefined {
  const metadata = asRecord(data.metadata);
  if (typeof metadata.purpose === 'string') return metadata.purpose;
  const custom = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];
  for (const field of custom) {
    const record = asRecord(field);
    if (
      (record.variable_name === 'purpose' || record.display_name === 'purpose') &&
      typeof record.value === 'string'
    ) {
      return record.value;
    }
  }
  return undefined;
}

function isSubscriptionCharge(data: Record<string, unknown>, reference?: string): boolean {
  if (typeof reference === 'string' && reference.startsWith('RR_SUB_')) return true;
  return metadataPurpose(data) === 'subscription';
}

export const subscriptionService = {
  async listPlans() {
    const plans = await subscriptionPlanRepository.findAll();
    if (plans.length > 0) return plans;
    await seedSubscriptionPlans();
    return subscriptionPlanRepository.findAll();
  },

  async ensureFreePlanForCustomer(userId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) return null;
    const existing = await subscriptionRepository.findByCustomer(customer._id.toString());
    if (existing) return existing;
    return subscriptionRepository.create({
      customer: customer._id,
      planSlug: 'free',
      status: 'active',
      provider: 'none',
      currentPeriodStart: new Date(),
    });
  },

  async getCurrent(userId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const subscription =
      (await subscriptionRepository.findByCustomer(customer._id.toString())) ??
      (await this.ensureFreePlanForCustomer(userId));
    const plan = await subscriptionPlanRepository.findBySlug(subscription?.planSlug ?? 'free');
    const entitlements = await entitlementService.getCustomerEntitlements(userId);
    return {
      subscription,
      plan,
      entitlements: entitlements.features,
      planSlug: entitlements.planSlug,
      status: entitlements.status,
      allowedServiceTypes: entitlements.allowedServiceTypes,
      restrictedServiceTypes: entitlements.restrictedServiceTypes,
      memberDiscountPercent: entitlementService.getMemberDiscountPercent(
        subscription?.planSlug ?? 'free',
      ),
    };
  },

  async checkout(userId: string, requestedPlan?: string) {
    const planSlug = (requestedPlan ?? BASIC_PLAN) as SubscriptionPlanSlug;
    if (planSlug === 'premium') {
      throw new ValidationError('Premium is coming soon and is not available for purchase yet.');
    }
    if (planSlug !== BASIC_PLAN) {
      throw new ValidationError('Only the Basic plan can be purchased.');
    }
    if (!isPaystackConfigured() || !basicPlanCode()) {
      throw new ApiError(
        503,
        'Subscription billing is not configured yet. Contact support or try again later.',
      );
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Customer account not found');
    let customer = await customerRepository.findByUserId(userId);
    if (!customer) {
      customer = await customerRepository.create({ userId: user._id, emergencyContacts: [] });
    }
    await seedSubscriptionPlans();

    const existing = await subscriptionRepository.findByCustomer(customer._id.toString());
    if (existing?.planSlug === 'basic' && existing.status === 'active') {
      throw new ConflictError('Your Basic subscription is already active.');
    }

    const amountGhs = env.SUBSCRIPTION_BASIC_PRICE_GHS;
    const reference = `RR_SUB_${customer._id.toString()}_${Date.now()}`;
    const callbackUrl = subscriptionCallbackUrl();

    logger.info('Initializing subscription checkout', {
      event: 'subscription.checkout.initialized',
      customerId: customer._id.toString(),
      planSlug: BASIC_PLAN,
      reference,
    });

    const initialized = await initializePaystackSubscription({
      email: user.email,
      amountGhs,
      reference,
      planCode: basicPlanCode(),
      callbackUrl,
      metadata: {
        purpose: 'subscription',
        planSlug: BASIC_PLAN,
        customerId: customer._id.toString(),
      },
    });

    await subscriptionCheckoutRepository.create({
      customer: customer._id,
      user: user._id,
      planSlug: BASIC_PLAN,
      provider: 'paystack',
      providerPlanCode: basicPlanCode(),
      reference: initialized.reference,
      amountGhs,
      amountPesewas: Math.round(amountGhs * 100),
      currency: 'GHS',
      status: 'pending',
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
    });

    await subscriptionRepository.upsertForCustomer(customer._id.toString(), {
      customer: customer._id,
      planSlug: existing?.planSlug === 'basic' ? 'basic' : existing?.planSlug ?? 'free',
      status: existing?.status === 'active' && existing.planSlug === 'basic' ? 'active' : 'incomplete',
      provider: 'paystack',
      providerPlanCode: basicPlanCode(),
      lastTransactionReference: initialized.reference,
    });

    return {
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
      callbackUrl,
      publicKey: env.PAYSTACK_PUBLIC_KEY,
      planSlug: BASIC_PLAN,
    };
  },

  /** @deprecated Use checkout. Kept so older clients posting /subscriptions/upgrade still work. */
  async initializeUpgrade(userId: string, planSlug: SubscriptionPlanSlug) {
    return this.checkout(userId, planSlug);
  },

  async verifyCheckout(userId: string, reference: string) {
    const checkout = await subscriptionCheckoutRepository.findByReference(reference);
    if (!checkout) throw new NotFoundError('Subscription payment not found');
    if (checkout.user.toString() !== userId) {
      throw new NotFoundError('Subscription payment not found');
    }

    if (checkout.status === 'success') {
      return this.getCurrent(userId);
    }

    const result = await verifyPaystackPayment(reference);
    if (result.status !== 'success') {
      checkout.status = 'failed';
      await checkout.save();
      logger.info('Subscription payment failed verification', {
        event: 'subscription.payment.failed',
        reference,
        status: result.status,
      });
      throw new ValidationError('Payment has not completed successfully');
    }

    await this.fulfillSuccessfulCharge({
      reference,
      amountPesewas: result.amount,
      currency: result.currency,
      paidAt: result.paid_at,
      customerCode: undefined,
    });

    return this.getCurrent(userId);
  },

  async fulfillSuccessfulCharge(input: {
    reference: string;
    amountPesewas: number;
    currency: string;
    paidAt?: string;
    customerCode?: string;
    subscriptionCode?: string;
    emailToken?: string;
    providerEventId?: string;
  }) {
    const checkout = await subscriptionCheckoutRepository.findByReference(input.reference);
    if (!checkout) {
      logger.info('Ignoring non-subscription Paystack charge', {
        event: 'subscription.payment.webhook.received',
        reference: input.reference,
      });
      return null;
    }
    if (checkout.status === 'success') {
      return checkout;
    }

    const currency = String(input.currency ?? '').trim().toUpperCase();
    if (currency !== 'GHS' || !Number.isFinite(input.amountPesewas) || input.amountPesewas <= 0) {
      throw new ValidationError('Payment amount or currency does not match');
    }
    if (input.amountPesewas !== checkout.amountPesewas) {
      logger.warn('Paystack charge amount differs from catalog price; using verified Paystack amount', {
        event: 'subscription.payment.amount.mismatch',
        reference: checkout.reference,
        expectedPesewas: checkout.amountPesewas,
        actualPesewas: input.amountPesewas,
      });
      checkout.amountPesewas = input.amountPesewas;
      checkout.amountGhs = input.amountPesewas / 100;
    }

    checkout.status = 'success';
    checkout.fulfilledAt = input.paidAt ? new Date(input.paidAt) : new Date();
    checkout.providerEventId = input.providerEventId;
    await checkout.save();

    const now = checkout.fulfilledAt;
    const periodEnd = new Date(now.getTime());
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await subscriptionRepository.upsertForCustomer(checkout.customer.toString(), {
      customer: checkout.customer,
      planSlug: BASIC_PLAN,
      status: 'active',
      provider: 'paystack',
      providerPlanCode: checkout.providerPlanCode,
      lastTransactionReference: checkout.reference,
      paystackCustomerCode: input.customerCode,
      paystackSubscriptionCode: input.subscriptionCode,
      paystackEmailToken: input.emailToken,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelledAt: undefined,
      cancelAtPeriodEnd: false,
    });

    logger.info('Basic subscription activated', {
      event: 'subscription.activated',
      customerId: checkout.customer.toString(),
      reference: checkout.reference,
    });
    logger.info('Subscription payment succeeded', {
      event: 'subscription.payment.success',
      reference: checkout.reference,
    });
    return checkout;
  },

  async handlePaystackEvent(event: string, data: Record<string, unknown>) {
    const eventId =
      (typeof data.id === 'number' && String(data.id)) ||
      (typeof data.id === 'string' && data.id) ||
      undefined;
    const reference = typeof data.reference === 'string' ? data.reference : undefined;
    const eventKey = `${event}:${eventId ?? reference ?? 'unknown'}`;
    const claimed = await processedPaystackEventRepository.claim(eventKey, event);
    if (!claimed) {
      logger.info('Duplicate Paystack webhook ignored', {
        event: 'subscription.payment.webhook.received',
        eventKey,
      });
      return;
    }

    logger.info('Paystack webhook received', {
      event: 'subscription.payment.webhook.received',
      paystackEvent: event,
      eventKey,
    });

    if (event === 'charge.success') {
      if (!isSubscriptionCharge(data, reference) || !reference) {
        logger.info('Ignoring service-payment Paystack charge', {
          event: 'subscription.payment.webhook.received',
          reference,
        });
        return;
      }
      const customer = asRecord(data.customer);
      const subscription = asRecord(data.subscription);
      await this.fulfillSuccessfulCharge({
        reference,
        amountPesewas: typeof data.amount === 'number' ? data.amount : -1,
        currency: typeof data.currency === 'string' ? data.currency : '',
        paidAt: typeof data.paid_at === 'string' ? data.paid_at : undefined,
        customerCode: typeof customer.customer_code === 'string' ? customer.customer_code : undefined,
        subscriptionCode:
          typeof subscription.subscription_code === 'string'
            ? subscription.subscription_code
            : undefined,
        providerEventId: eventId,
      });
      return;
    }

    if (event === 'subscription.create') {
      const code =
        typeof data.subscription_code === 'string' ? data.subscription_code : undefined;
      const customer = asRecord(data.customer);
      const customerCode =
        typeof customer.customer_code === 'string' ? customer.customer_code : undefined;
      if (!code) return;
      let subscription = await subscriptionRepository.findByPaystackSubscriptionCode(code);
      if (!subscription && customerCode) {
        // Match the most recent incomplete/basic record by customer code after first charge.
        subscription = await subscriptionRepository.findByLastTransactionReference(
          typeof data.reference === 'string' ? data.reference : '',
        );
      }
      if (subscription) {
        subscription.paystackSubscriptionCode = code;
        subscription.paystackEmailToken =
          typeof data.email_token === 'string' ? data.email_token : subscription.paystackEmailToken;
        subscription.paystackCustomerCode = customerCode ?? subscription.paystackCustomerCode;
        subscription.status = mapPaystackSubscriptionStatus(data.status) ?? subscription.status;
        subscription.planSlug = BASIC_PLAN;
        subscription.provider = 'paystack';
        if (typeof data.next_payment_date === 'string') {
          subscription.currentPeriodEnd = new Date(data.next_payment_date);
        }
        await subscription.save();
      }
      return;
    }

    if (event === 'subscription.disable' || event === 'subscription.not_renew') {
      const code =
        typeof data.subscription_code === 'string' ? data.subscription_code : undefined;
      if (!code) return;
      const subscription = await subscriptionRepository.findByPaystackSubscriptionCode(code);
      if (!subscription) return;
      if (event === 'subscription.disable') {
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        subscription.cancelAtPeriodEnd = false;
        logger.info('Subscription cancelled', {
          event: 'subscription.cancelled',
          subscriptionCode: code,
        });
      } else {
        subscription.status = 'non_renewing';
        subscription.cancelAtPeriodEnd = true;
      }
      await subscription.save();
      return;
    }

    if (event === 'invoice.payment_failed') {
      const subscriptionPayload = asRecord(data.subscription);
      const code =
        (typeof subscriptionPayload.subscription_code === 'string' &&
          subscriptionPayload.subscription_code) ||
        (typeof data.subscription_code === 'string' && data.subscription_code) ||
        undefined;
      if (!code) return;
      const subscription = await subscriptionRepository.findByPaystackSubscriptionCode(code);
      if (!subscription) return;
      subscription.status = 'past_due';
      await subscription.save();
      logger.info('Subscription invoice payment failed', {
        event: 'subscription.payment.failed',
        subscriptionCode: code,
      });
      return;
    }

    if (event === 'invoice.update') {
      const paid = data.status === 'success' || data.paid === true || data.status === 'paid';
      const subscriptionPayload = asRecord(data.subscription);
      const code =
        typeof subscriptionPayload.subscription_code === 'string'
          ? subscriptionPayload.subscription_code
          : undefined;
      if (!code || !paid) return;
      const subscription = await subscriptionRepository.findByPaystackSubscriptionCode(code);
      if (!subscription) return;
      subscription.status = 'active';
      subscription.planSlug = BASIC_PLAN;
      if (typeof data.period_end === 'string') {
        subscription.currentPeriodEnd = new Date(data.period_end);
      }
      await subscription.save();
      logger.info('Subscription renewed', {
        event: 'subscription.renewed',
        subscriptionCode: code,
      });
    }
  },

  async downgradeToFree(userId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    return subscriptionRepository.upsertForCustomer(customer._id.toString(), {
      customer: customer._id,
      planSlug: 'free',
      status: 'active',
      provider: 'none',
      cancelAtPeriodEnd: false,
      paystackSubscriptionCode: undefined,
      currentPeriodEnd: undefined,
    });
  },
};

function mapPaystackSubscriptionStatus(status: unknown): SubscriptionStatus | undefined {
  if (typeof status !== 'string') return undefined;
  if (status === 'active') return 'active';
  if (status === 'non-renewing' || status === 'non_renewing') return 'non_renewing';
  if (status === 'attention' || status === 'past_due') return 'past_due';
  if (status === 'cancelled' || status === 'completed') return 'cancelled';
  return undefined;
}

export async function seedSubscriptionPlans(): Promise<void> {
  await subscriptionPlanRepository.upsertPlan({
    slug: 'free',
    name: 'Free',
    description: 'Core Road Rescue access for requesting roadside help.',
    monthlyPriceGhs: 0,
    features: ['mechanic_discovery', 'mechanic_profile', 'mechanic_reviews', 'service_upload'],
    sortOrder: 0,
  });
  await subscriptionPlanRepository.upsertPlan({
    slug: 'basic',
    name: 'Basic',
    description:
      'Roadside help for common issues, mechanic discovery, profiles, and ratings. Towing, fuel delivery, and accident services are reserved for Premium.',
    monthlyPriceGhs: env.SUBSCRIPTION_BASIC_PRICE_GHS,
    features: [
      'mechanic_discovery',
      'mechanic_profile',
      'mechanic_reviews',
      'service_upload',
      'priority_matching',
      'member_discount',
    ],
    sortOrder: 1,
    paystackPlanCode: env.PAYSTACK_BASIC_PLAN_CODE,
  });
  await subscriptionPlanRepository.upsertPlan({
    slug: 'premium',
    name: 'Premium',
    description: 'Everything in Basic plus towing, fuel delivery, accident support, and premium support.',
    monthlyPriceGhs: env.SUBSCRIPTION_PREMIUM_PRICE_GHS,
    features: [
      'priority_matching',
      'member_discount',
      'premium_support',
      'higher_member_discount',
      'mechanic_discovery',
      'mechanic_profile',
      'mechanic_reviews',
      'service_upload',
      'service_towing',
      'service_fuel',
      'service_accident',
    ],
    sortOrder: 2,
  });
}
