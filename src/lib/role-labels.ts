import type { Role } from '@/api/types';

/** Query values that select the provider registration role. */
export function parseRegisterRoleParam(value: string | null): Extract<Role, 'customer' | 'mechanic'> {
  if (value === 'mechanic' || value === 'provider') return 'mechanic';
  return 'customer';
}

export function registerRoleQuery(role: 'customer' | 'mechanic'): string {
  return role === 'mechanic' ? 'provider' : '';
}

export function roleLabel(role: Role | 'customer' | 'mechanic'): string {
  if (role === 'mechanic') return 'Provider';
  if (role === 'admin') return 'Admin';
  return 'Customer';
}
