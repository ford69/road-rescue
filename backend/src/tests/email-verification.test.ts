import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createEmailVerification,
  EMAIL_VERIFICATION_TTL_MS,
  evaluateVerificationToken,
  isLegacyAccount,
} from '../auth/email-verification.js';
import { AuthErrorCode, ForbiddenError } from '../utils/errors.js';
import { requireEmailVerification } from '../middleware/requireEmailVerification.js';
import { userRepository } from '../repositories/user.repository.js';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

describe('email verification tokens', () => {
  it('creates a hashed token with a 24-hour expiry', () => {
    const now = new Date('2026-09-04T12:00:00.000Z');
    const issued = createEmailVerification(now);
    expect(issued.token).toHaveLength(64);
    expect(issued.tokenHash).toBe(crypto.createHash('sha256').update(issued.token).digest('hex'));
    expect(issued.tokenHash).not.toBe(issued.token);
    expect(issued.expiresAt.getTime() - now.getTime()).toBe(EMAIL_VERIFICATION_TTL_MS);
  });

  it('accepts unused unexpired tokens', () => {
    expect(
      evaluateVerificationToken({
        emailVerified: false,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).toBe('valid');
  });

  it('accepts legacy tokens without an expiry', () => {
    expect(evaluateVerificationToken({ emailVerified: false, expiresAt: null })).toBe('valid');
  });

  it('rejects expired tokens', () => {
    expect(
      evaluateVerificationToken({
        emailVerified: false,
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        now: new Date('2026-09-04T00:00:00.000Z'),
      }),
    ).toBe('expired');
  });

  it('detects already-verified accounts', () => {
    expect(
      evaluateVerificationToken({
        emailVerified: true,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).toBe('already_verified');
  });

  it('treats previously signed-in unverified users as legacy accounts', () => {
    expect(isLegacyAccount({ emailVerified: false, lastLogin: new Date() })).toBe(true);
    expect(isLegacyAccount({ emailVerified: false, lastLogin: null })).toBe(false);
    expect(isLegacyAccount({ emailVerified: true, lastLogin: new Date() })).toBe(false);
  });
});

describe('requireEmailVerification middleware', () => {
  const res = {} as Response;

  it('blocks unverified users with EMAIL_NOT_VERIFIED', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      emailVerified: false,
    } as never);
    const next = vi.fn() as NextFunction;
    const req = { user: { id: 'u1', role: 'customer', email: 'a@b.c' } } as Request;

    await requireEmailVerification(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const error = vi.mocked(next).mock.calls[0][0] as ForbiddenError;
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.code).toBe(AuthErrorCode.EMAIL_NOT_VERIFIED);
    expect(error.statusCode).toBe(403);
  });

  it('allows verified users', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      emailVerified: true,
    } as never);
    const next = vi.fn() as NextFunction;
    const req = { user: { id: 'u1', role: 'customer', email: 'a@b.c' } } as Request;

    await requireEmailVerification(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('grandfathers accounts that signed in before email verification', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    vi.mocked(userRepository.findById).mockResolvedValue({
      emailVerified: false,
      lastLogin: new Date('2026-01-01T00:00:00.000Z'),
      save,
    } as never);
    const next = vi.fn() as NextFunction;
    const req = { user: { id: 'u1', role: 'customer', email: 'a@b.c' } } as Request;

    await requireEmailVerification(req, res, next);

    expect(save).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});
