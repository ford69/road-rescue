import type { ServiceTypeSlug, SubscriptionFeature, SubscriptionPlanSlug } from '../types/index.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { AuthErrorCode, ForbiddenError } from '../utils/errors.js';
import { allowedServicesForPlan, planAllowsService } from './plan-access.js';

const BASIC_FEATURES: SubscriptionFeature[] = [
  'mechanic_discovery',
  'mechanic_profile',
  'mechanic_reviews',
  'service_upload',
  'priority_matching',
  'member_discount',
];

const PLAN_ENTITLEMENTS: Record<SubscriptionPlanSlug, SubscriptionFeature[]> = {
  free: ['mechanic_discovery', 'mechanic_profile', 'mechanic_reviews', 'service_upload'],
  basic: BASIC_FEATURES,
  premium: [
    ...BASIC_FEATURES,
    'premium_support',
    'higher_member_discount',
    'service_towing',
    'service_fuel',
    'service_accident',
  ],
};

export const entitlementService = {
  getEntitlementsForPlan(planSlug: SubscriptionPlanSlug): SubscriptionFeature[] {
    return PLAN_ENTITLEMENTS[planSlug] ?? [];
  },

  async getCustomerEntitlements(userId: string): Promise<{
    planSlug: SubscriptionPlanSlug;
    features: SubscriptionFeature[];
    status: string;
    allowedServiceTypes: ServiceTypeSlug[];
    restrictedServiceTypes: ServiceTypeSlug[];
  }> {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) {
      return {
        planSlug: 'free',
        features: [],
        status: 'active',
        allowedServiceTypes: allowedServicesForPlan('free', 'active'),
        restrictedServiceTypes: ['towing', 'fuel', 'accident'],
      };
    }
    const subscription = await subscriptionRepository.findByCustomer(customer._id.toString());
    const planSlug = subscription?.planSlug ?? 'free';
    const status = subscription?.status ?? 'active';
    const active = status === 'active';
    const allowedServiceTypes = allowedServicesForPlan(planSlug, status);
    return {
      planSlug,
      features: active ? this.getEntitlementsForPlan(planSlug) : this.getEntitlementsForPlan('free'),
      status,
      allowedServiceTypes,
      restrictedServiceTypes: ['towing', 'fuel', 'accident'].filter(
        (service) => !allowedServiceTypes.includes(service as ServiceTypeSlug),
      ) as ServiceTypeSlug[],
    };
  },

  async hasFeature(userId: string, feature: SubscriptionFeature): Promise<boolean> {
    const entitlements = await this.getCustomerEntitlements(userId);
    return entitlements.features.includes(feature);
  },

  async assertServiceAllowed(userId: string, serviceType: ServiceTypeSlug): Promise<void> {
    const entitlements = await this.getCustomerEntitlements(userId);
    if (planAllowsService(entitlements.planSlug, entitlements.status, serviceType)) return;
    throw new ForbiddenError(
      `${serviceType} is not included in your ${entitlements.planSlug} plan. Upgrade to Premium to access this service.`,
      AuthErrorCode.PLAN_FEATURE_NOT_AVAILABLE,
    );
  },

  getMemberDiscountPercent(planSlug: SubscriptionPlanSlug): number {
    if (planSlug === 'premium') return 15;
    if (planSlug === 'basic') return 8;
    return 0;
  },
};
