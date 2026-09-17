import type { ServiceType } from '@/api/types';

export const PREMIUM_ONLY_SERVICES: ServiceType[] = ['fuel', 'accident'];

export const BASIC_INCLUDED_SERVICES: ServiceType[] = [
  'flat-tire',
  'battery',
  'lockout',
  'towing',
  'other',
];

export function isPremiumOnlyService(service: ServiceType): boolean {
  return PREMIUM_ONLY_SERVICES.includes(service);
}
