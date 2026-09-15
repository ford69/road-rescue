import type { ServiceTypeSlug, SubscriptionPlanSlug } from '../types/index.js';

export const PREMIUM_ONLY_SERVICES: ServiceTypeSlug[] = ['towing', 'fuel', 'accident'];

export const BASIC_INCLUDED_SERVICES: ServiceTypeSlug[] = [
  'flat-tire',
  'battery',
  'lockout',
  'other',
];

export function isSubscriptionActive(status: string): boolean {
  return status === 'active' || status === 'non_renewing';
}

export function isPaidCustomerPlan(
  planSlug: SubscriptionPlanSlug,
  status: string,
): boolean {
  if (!isSubscriptionActive(status)) return false;
  // Legacy `free` records are treated as Basic (the free customer tier).
  return planSlug === 'basic' || planSlug === 'premium' || planSlug === 'free';
}

export function planAllowsService(
  planSlug: SubscriptionPlanSlug,
  status: string,
  serviceType: ServiceTypeSlug,
): boolean {
  if (!PREMIUM_ONLY_SERVICES.includes(serviceType)) return true;
  return isSubscriptionActive(status) && planSlug === 'premium';
}

export function allowedServicesForPlan(
  planSlug: SubscriptionPlanSlug,
  status: string,
): ServiceTypeSlug[] {
  const all: ServiceTypeSlug[] = [...BASIC_INCLUDED_SERVICES, ...PREMIUM_ONLY_SERVICES];
  return all.filter((service) => planAllowsService(planSlug, status, service));
}
