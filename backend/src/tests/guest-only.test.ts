import { describe, expect, it, vi } from 'vitest';
import { guestOnly } from '../middleware/auth.js';
import { signAccessToken } from '../auth/tokens.js';
import { ForbiddenError } from '../utils/errors.js';
import type { NextFunction, Request, Response } from 'express';

describe('guestOnly', () => {
  const res = {} as Response;

  it('allows requests with no token', () => {
    const next = vi.fn() as NextFunction;
    guestOnly({ headers: {}, cookies: {} } as Request, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a valid leftover session', () => {
    const token = signAccessToken({ sub: 'u1', role: 'customer', email: 'a@b.c' });
    const next = vi.fn() as NextFunction;
    guestOnly({ headers: { authorization: `Bearer ${token}` }, cookies: {} } as Request, res, next);
    const error = vi.mocked(next).mock.calls[0][0] as ForbiddenError;
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe('Already authenticated');
  });

  it('allows an expired or invalid token through so login can replace it', () => {
    const next = vi.fn() as NextFunction;
    guestOnly(
      { headers: { authorization: 'Bearer not-a-token' }, cookies: {} } as Request,
      res,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });
});
