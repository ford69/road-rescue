import { env } from '../config/env.js';
import type { Response } from 'express';

export function authCookieBase() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: (env.COOKIE_SECURE ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const common = authCookieBase();
  res.cookie('accessToken', accessToken, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response): void {
  const expired = { maxAge: 0, expires: new Date(0) };
  const variants = [
    authCookieBase(),
    // Older deploys may have set Lax / non-Secure cookies; expire those too.
    { httpOnly: true, secure: true, sameSite: 'none' as const, path: '/' },
    { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' },
    { httpOnly: true, secure: false, sameSite: 'lax' as const, path: '/' },
  ];
  for (const common of variants) {
    res.cookie('accessToken', '', { ...common, ...expired });
    res.cookie('refreshToken', '', { ...common, ...expired });
  }
}
