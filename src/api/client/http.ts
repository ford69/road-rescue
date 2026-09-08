import type { ApiResponse } from '../types';
import { tokenStore } from '../utils/tokenStore';
import {
  isPublicAuthPath,
  shouldAttemptRefresh,
} from './auth-session';
import { statusFallbackMessage } from './parse-response';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export const EMAIL_NOT_VERIFIED_EVENT = 'rr:email-not-verified';
export const SUBSCRIPTION_REQUIRED_EVENT = 'rr:subscription-required';

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
  const text = await response.text();
  if (!text) {
    if (!response.ok) {
      throw new ApiClientError(statusFallbackMessage(response.status), response.status);
    }
    return { success: true, message: '', data: undefined as T };
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(statusFallbackMessage(response.status), response.status);
  }
}

let refreshPromise: Promise<boolean> | null = null;
let refreshGeneration = -1;

function authLog(event: string, extra?: Record<string, unknown>): void {
  console.info(`[auth] ${event}`, extra ?? {});
}

async function refreshAccessToken(epoch: number): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken || tokenStore.generation() !== epoch) return false;

  authLog('auth.refresh.started', { generation: epoch });
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refreshToken }),
  });

  if (tokenStore.generation() !== epoch) {
    authLog('auth.refresh.ignored', { reason: 'session_replaced' });
    return false;
  }

  if (!response.ok) {
    authLog('auth.refresh.failed', { status: response.status });
    tokenStore.clear();
    return false;
  }

  const payload = await parseJson<{ tokens: { accessToken: string; refreshToken: string } }>(
    response,
  );
  if (!payload.data?.tokens) {
    tokenStore.clear();
    return false;
  }
  tokenStore.replace(payload.data.tokens.accessToken, payload.data.tokens.refreshToken);
  authLog('auth.refresh.success', { generation: epoch });
  return true;
}

function notifyEmailNotVerified(path: string): void {
  if (path.startsWith('/auth/')) return;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EMAIL_NOT_VERIFIED_EVENT));
}

function notifySubscriptionRequired(path: string): void {
  if (path.startsWith('/auth/')) return;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SUBSCRIPTION_REQUIRED_EVENT));
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

  const requestGeneration = tokenStore.generation();
  const accessToken = isPublicAuthPath(path) ? null : tokenStore.getAccess();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (
    shouldAttemptRefresh({
      status: response.status,
      retry,
      path,
      requestGeneration,
      currentGeneration: tokenStore.generation(),
      hasRefreshToken: Boolean(tokenStore.getRefresh()),
    })
  ) {
    if (!refreshPromise || refreshGeneration !== requestGeneration) {
      refreshGeneration = requestGeneration;
      refreshPromise = refreshAccessToken(requestGeneration).finally(() => {
        if (refreshGeneration === requestGeneration) {
          refreshPromise = null;
        }
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed && tokenStore.generation() === requestGeneration) {
      return apiRequest<T>(path, options, false);
    }
  }

  const payload = await parseJson<T>(response);
  if (!response.ok || !payload.success) {
    if (payload.code === 'EMAIL_NOT_VERIFIED') {
      notifyEmailNotVerified(path);
    }
    if (payload.code === 'SUBSCRIPTION_REQUIRED') {
      notifySubscriptionRequired(path);
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
