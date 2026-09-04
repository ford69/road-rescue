import type { ApiUser } from '@/api/types';

export const PENDING_VERIFY_EMAIL_KEY = 'rr_pending_verify_email';

export function rememberPendingEmail(email: string): void {
  try {
    sessionStorage.setItem(PENDING_VERIFY_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    // ignore
  }
}

export function readPendingEmail(): string {
  try {
    return sessionStorage.getItem(PENDING_VERIFY_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearPendingEmail(): void {
  try {
    sessionStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
  } catch {
    // ignore
  }
}

export function postAuthPath(user: ApiUser, fallback?: string | null): string {
  if (!user.emailVerified) return '/auth/verify-email';
  if (fallback && fallback.startsWith('/') && !fallback.startsWith('/auth/')) {
    return fallback;
  }
  return `/${user.role}/home`;
}
