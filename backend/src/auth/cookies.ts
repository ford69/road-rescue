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
  const expired = {
    ...authCookieBase(),
    maxAge: 0,
    expires: new Date(0),
  };
  // Overwrite with an expired cookie using the same attributes as set.
  // clearCookie() is unreliable in Safari when SameSite/Secure do not match exactly.
  res.cookie('accessToken', '', expired);
  res.cookie('refreshToken', '', expired);
}
