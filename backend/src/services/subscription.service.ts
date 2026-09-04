import { env } from '../config/env.js';
import { customerRepository } from '../repositories/customer.repository.js';
import {
  subscriptionPlanRepository,
  subscriptionRepository,
} from '../repositories/subscription.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { isPaystackConfigured } from '../payments/paystack.js';
import { entitlementService } from './entitlement.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { SubscriptionPlanSlug } from '../types/index.js';

export const subscriptionService = {
  async listPlans() {
    return subscriptionPlanRepository.findAll();
  },

  async ensureFreePlanForCustomer(userId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) return null;
    const existing = await subscriptionRepository.findByCustomer(customer._id.toString());
    if (existing) return existing;
    return subscriptionRepository.create({
      customer: customer._id,
      planSlug: 'basic',
      status: 'active',
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

  async initializeUpgrade(userId: string, planSlug: SubscriptionPlanSlug) {
    if (planSlug === 'premium') {
      throw new ValidationError('Premium is coming soon and is not available for purchase yet.');
    }
    if (planSlug === 'free') {
      throw new ValidationError('Use downgrade to move to the Free plan');
    }
    if (!isPaystackConfigured()) {
      throw new ValidationError(
        'Subscription billing is not configured yet. Contact support or try again later.',
      );
    }

    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Customer account not found');
    const plan = await subscriptionPlanRepository.findBySlug(planSlug);
    if (!plan) throw new NotFoundError('Subscription plan not found');

    await subscriptionRepository.upsertForCustomer(customer._id.toString(), {
      customer: customer._id,
      planSlug,
      status: 'incomplete',
    });

    return {
      plan,
      checkoutConfigured: Boolean(plan.paystackPlanCode),
      message: plan.paystackPlanCode
        ? 'Paystack subscription checkout is ready to be connected.'
        : `Plan pricing is GHS ${plan.monthlyPriceGhs}/month. Paystack plan code is not configured yet.`,
      callbackUrl: `${env.PRIMARY_CLIENT_ORIGIN}/customer/profile`,
      customerEmail: user.email,
    };
  },

  async downgradeToFree(userId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    return subscriptionRepository.upsertForCustomer(customer._id.toString(), {
      customer: customer._id,
      planSlug: 'free',
      status: 'active',
      cancelAtPeriodEnd: false,
      paystackSubscriptionCode: undefined,
      currentPeriodEnd: undefined,
    });
  },
};

export async function seedSubscriptionPlans(): Promise<void> {
  await subscriptionPlanRepository.upsertPlan({
    slug: 'free',
    name: 'Free',
    description: 'Core Road Rescue access. Service requests are still paid per rescue.',
    monthlyPriceGhs: 0,
    features: [],
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
