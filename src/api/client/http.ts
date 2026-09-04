import type { ApiResponse } from '../types';
import { tokenStore } from '../utils/tokenStore';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export const EMAIL_NOT_VERIFIED_EVENT = 'rr:email-not-verified';

export class ApiClientError extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(message: string, status: number, details?: unknown, code?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    tokenStore.clear();
    return false;
  }

  const payload = await parseJson<{ tokens: { accessToken: string; refreshToken: string } }>(
    response,
  );
  tokenStore.set(payload.data.tokens.accessToken, payload.data.tokens.refreshToken);
  return true;
}

function notifyEmailNotVerified(path: string): void {
  if (path.startsWith('/auth/')) return;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EMAIL_NOT_VERIFIED_EVENT));
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = tokenStore.getAccess();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 401 && retry) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }
  }

  const payload = await parseJson<T>(response);
  if (!response.ok || !payload.success) {
    if (payload.code === 'EMAIL_NOT_VERIFIED') {
      notifyEmailNotVerified(path);
    }
    throw new ApiClientError(
      payload.message || 'Request failed',
      response.status,
      payload.details,
      payload.code,
    );
  }

  return payload.data;
}
