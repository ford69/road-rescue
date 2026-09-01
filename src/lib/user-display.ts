import type { ApiUser } from '@/api/types';

export function getUserInitials(
  user: Pick<ApiUser, 'firstName' | 'lastName'> | null | undefined,
): string {
  if (!user) return 'RR';
  const first = user.firstName?.trim()?.[0] ?? '';
  const last = user.lastName?.trim()?.[0] ?? '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || 'RR';
}

function uploadsOrigin(): string | null {
  const configured = import.meta.env.VITE_UPLOADS_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const apiBase = import.meta.env.VITE_API_URL ?? '/api';
  if (apiBase.startsWith('http')) {
    try {
      return new URL(apiBase).origin;
    } catch {
      return null;
    }
  }

  const proxyTarget = import.meta.env.VITE_API_PROXY_TARGET?.trim();
  if (proxyTarget?.startsWith('http')) {
    try {
      return new URL(proxyTarget).origin;
    } catch {
      return null;
    }
  }

  return null;
}

/** Resolves avatar/upload paths for dev proxy and production API origins. */
export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;

  const normalized = path.startsWith('/') ? path : `/${path}`;

  // Dev: Vite proxies /uploads to the API — keep same-origin paths.
  if (import.meta.env.DEV && normalized.startsWith('/uploads/')) {
    return normalized;
  }

  const origin = uploadsOrigin();

  if (origin && normalized.startsWith('/uploads/')) {
    return `${origin}${normalized}`;
  }

  return normalized;
}
