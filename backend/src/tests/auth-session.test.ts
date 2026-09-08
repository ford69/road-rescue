import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthCookies, authCookieBase } from '../auth/cookies.js';
import type { Response } from 'express';
import { shouldAttemptRefresh, shouldRestoreSessionOnPath } from '../../../src/api/client/auth-session.ts';
import { tokenStore } from '../../../src/api/utils/tokenStore.ts';

describe('auth cookies', () => {
  it('clears access and refresh cookies with the same attributes used to set them', () => {
    const cookie = vi.fn();
    const res = { cookie } as unknown as Response;
    clearAuthCookies(res);
    const base = authCookieBase();
    expect(cookie).toHaveBeenCalledWith(
      'accessToken',
      '',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: base.sameSite,
        secure: base.secure,
        maxAge: 0,
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      'refreshToken',
      '',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: base.sameSite,
        secure: base.secure,
        maxAge: 0,
      }),
    );
  });
});

describe('frontend session restore and refresh rules', () => {
  it('does not restore a session on the registration page', () => {
    expect(shouldRestoreSessionOnPath('/auth/register')).toBe(false);
    expect(shouldRestoreSessionOnPath('/auth/login')).toBe(false);
    expect(shouldRestoreSessionOnPath('/customer/home')).toBe(true);
    expect(shouldRestoreSessionOnPath('/auth/complete-subscription')).toBe(true);
  });

  it('does not refresh public registration or logout requests', () => {
    expect(
      shouldAttemptRefresh({
        status: 401,
        retry: true,
        path: '/auth/register/customer',
        requestGeneration: 1,
        currentGeneration: 1,
        hasRefreshToken: true,
      }),
    ).toBe(false);
    expect(
      shouldAttemptRefresh({
        status: 401,
        retry: true,
        path: '/auth/logout',
        requestGeneration: 1,
        currentGeneration: 1,
        hasRefreshToken: true,
      }),
    ).toBe(false);
  });

  it('does not refresh after the auth generation has changed', () => {
    expect(
      shouldAttemptRefresh({
        status: 401,
        retry: true,
        path: '/auth/me',
        requestGeneration: 1,
        currentGeneration: 2,
        hasRefreshToken: true,
      }),
    ).toBe(false);
  });

  it('refreshes a protected 401 only when a refresh token exists', () => {
    expect(
      shouldAttemptRefresh({
        status: 401,
        retry: true,
        path: '/auth/me',
        requestGeneration: 3,
        currentGeneration: 3,
        hasRefreshToken: true,
      }),
    ).toBe(true);
    expect(
      shouldAttemptRefresh({
        status: 401,
        retry: true,
        path: '/auth/me',
        requestGeneration: 3,
        currentGeneration: 3,
        hasRefreshToken: false,
      }),
    ).toBe(false);
  });
});

describe('tokenStore session generation', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
      },
    });
  });

  it('bumps generation on login and logout so an in-flight refresh cannot restore account A', () => {
    tokenStore.set('access-a', 'refresh-a');
    const accountA = tokenStore.generation();
    tokenStore.clear();
    expect(tokenStore.getAccess()).toBeNull();
    expect(tokenStore.getRefresh()).toBeNull();
    expect(tokenStore.generation()).toBeGreaterThan(accountA);
    tokenStore.set('access-b', 'refresh-b');
    expect(tokenStore.getAccess()).toBe('access-b');
    expect(shouldAttemptRefresh({
      status: 401,
      retry: true,
      path: '/auth/me',
      requestGeneration: accountA,
      currentGeneration: tokenStore.generation(),
      hasRefreshToken: true,
    })).toBe(false);
  });
});

