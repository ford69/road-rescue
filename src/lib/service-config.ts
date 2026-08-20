import type { ServiceType } from '@/api/types';

/** Fallback labels/prices in Ghana Cedis when catalog has not loaded yet. */
export const serviceTypeConfig: Record<
  ServiceType,
  { label: string; icon: string; description: string; basePrice: number }
> = {
  towing: {
    label: 'Towing',
    icon: 'Truck',
    description: 'Vehicle needs to be towed to a repair shop',
    basePrice: 350,
  },
  'flat-tire': {
    label: 'Flat Tyre',
    icon: 'CircleDot',
    description: 'Tyre change or repair at your location',
    basePrice: 120,
  },
  battery: {
    label: 'Battery Jump Start',
    icon: 'BatteryCharging',
    description: 'Jump-start or battery replacement',
    basePrice: 100,
  },
  lockout: {
    label: 'Lockout',
    icon: 'KeyRound',
    description: 'Keys locked inside vehicle',
    basePrice: 180,
  },
  fuel: {
    label: 'Fuel Delivery',
    icon: 'Fuel',
    description: 'Emergency fuel delivery',
    basePrice: 150,
  },
  accident: {
    label: 'Accident Assist',
    icon: 'AlertTriangle',
    description: 'Post-accident assistance and recovery',
    basePrice: 500,
  },
  other: {
    label: 'Engine Diagnostics',
    icon: 'Wrench',
    description: 'Describe your problem in detail',
    basePrice: 200,
  },
};

export function mechanicDisplayName(mechanic: {
  garageName?: string;
  userId?: { firstName?: string; lastName?: string };
}): string {
  if (mechanic.userId?.firstName) {
    return `${mechanic.userId.firstName} ${mechanic.userId.lastName ?? ''}`.trim();
  }
  return mechanic.garageName ?? 'Mechanic';
}

export function mechanicInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
