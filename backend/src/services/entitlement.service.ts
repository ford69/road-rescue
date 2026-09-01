import type { SubscriptionFeature, SubscriptionPlanSlug } from '../types/index.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';

const PLAN_ENTITLEMENTS: Record<SubscriptionPlanSlug, SubscriptionFeature[]> = {
  free: [],
  basic: ['priority_matching', 'member_discount'],
  premium: ['priority_matching', 'member_discount', 'premium_support', 'higher_member_discount'],
};

export const entitlementService = {
  getEntitlementsForPlan(planSlug: SubscriptionPlanSlug): SubscriptionFeature[] {
    return PLAN_ENTITLEMENTS[planSlug] ?? [];
  },

  async getCustomerEntitlements(userId: string): Promise<{
    planSlug: SubscriptionPlanSlug;
    features: SubscriptionFeature[];
    status: string;
  }> {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) {
      return { planSlug: 'free', features: [], status: 'active' };
    }
    const subscription = await subscriptionRepository.findByCustomer(customer._id.toString());
    const planSlug = subscription?.planSlug ?? 'free';
    const status = subscription?.status ?? 'active';
    const active = status === 'active';
    return {
      planSlug,
      features: active ? this.getEntitlementsForPlan(planSlug) : [],
      status,
    };
  },

  async hasFeature(userId: string, feature: SubscriptionFeature): Promise<boolean> {
    const entitlements = await this.getCustomerEntitlements(userId);
    return entitlements.features.includes(feature);
  },

  getMemberDiscountPercent(planSlug: SubscriptionPlanSlug): number {
    if (planSlug === 'premium') return 15;
    if (planSlug === 'basic') return 8;
    return 0;
  },
};
