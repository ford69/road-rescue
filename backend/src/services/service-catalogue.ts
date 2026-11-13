import type { ServiceTypeSlug } from '../types/index.js';

export const SERVICE_TYPE_SLUGS: ServiceTypeSlug[] = [
  'towing',
  'flat-tire',
  'battery',
  'lockout',
  'fuel',
  'accident',
  'other',
];

export const SERVICE_CATEGORIES: Array<{
  id: string;
  name: string;
  slugs: ServiceTypeSlug[];
}> = [
  { id: 'tyre', name: 'Tyre assistance', slugs: ['flat-tire'] },
  { id: 'mechanical', name: 'Mechanical assistance', slugs: ['battery', 'other'] },
  { id: 'towing', name: 'Towing and recovery', slugs: ['towing', 'accident'] },
  { id: 'lockout', name: 'Lockout', slugs: ['lockout'] },
  { id: 'fuel', name: 'Fuel assistance', slugs: ['fuel'] },
];

export function categoryIdForSlug(slug: ServiceTypeSlug): string {
  return SERVICE_CATEGORIES.find((category) => category.slugs.includes(slug))?.id ?? 'mechanical';
}
