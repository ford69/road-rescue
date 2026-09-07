import type { ServiceType } from '@/api/types';

/** Fallback labels when catalog has not loaded yet. */
export const serviceTypeConfig: Record<
  ServiceType,
  { label: string; icon: string; description: string }
> = {
  towing: {
    label: 'Towing',
    icon: 'Truck',
    description: 'Vehicle needs to be towed to a repair shop',
  },
  'flat-tire': {
    label: 'Flat Tyre',
    icon: 'CircleDot',
    description: 'Tyre change or repair at your location',
  },
  battery: {
    label: 'Battery Jump Start',
    icon: 'BatteryCharging',
    description: 'Jump-start or battery replacement',
  },
  lockout: {
    label: 'Lockout',
    icon: 'KeyRound',
    description: 'Keys locked inside vehicle',
  },
  fuel: {
    label: 'Fuel Delivery',
    icon: 'Fuel',
    description: 'Emergency fuel delivery',
  },
  accident: {
    label: 'Accident Assist',
    icon: 'AlertTriangle',
    description: 'Post-accident assistance and recovery',
  },
  other: {
    label: 'Engine Diagnostics',
    icon: 'Wrench',
    description: 'Describe your problem in detail',
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
