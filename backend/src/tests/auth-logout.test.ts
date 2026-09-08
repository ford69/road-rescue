import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { hashToken, createTokenPair } from '../auth/tokens.js';
import { userRepository } from '../repositories/user.repository.js';
import { authService } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { Response } from 'express';
import { createApp } from '../app.js';

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: {
    findByIdWithSecrets: vi.fn(),
    findByEmailWithSecrets: vi.fn(),
  },
}));

vi.mock('../repositories/customer.repository.js', () => ({
  customerRepository: { create: vi.fn(), findByUserId: vi.fn() },
}));

vi.mock('../repositories/mechanic.repository.js', () => ({
  mechanicRepository: {},
}));

vi.mock('../repositories/misc.repository.js', () => ({
  notificationRepository: { create: vi.fn() },
}));

vi.mock('../email/index.js', () => ({
  emailService: { sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() },
}));

vi.mock('../services/subscription.service.js', () => ({
  subscriptionService: { ensureFreePlanForCustomer: vi.fn() },
}));

vi.mock('../services/entitlement.service.js', () => ({
  entitlementService: { getCustomerEntitlements: vi.fn() },
}));

function cookieRes() {
  return { cookie: vi.fn() } as unknown as Response;
}

describe('logout and refresh isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes the refresh session so the old token cannot mint a new access token', async () => {
    const tokens = createTokenPair('64a000000000000000000001', 'customer', 'a@example.com');
    const hash = await hashToken(tokens.refreshToken);
    const user = {
      _id: { toString: () => '64a000000000000000000001' },
      role: 'customer' as const,
      email: 'a@example.com',
      refreshTokenHash: hash,
      save: vi.fn(async function save(this: { refreshTokenHash?: string }) {
        return this;
      }),
    };
    vi.mocked(userRepository.findByIdWithSecrets).mockResolvedValue(user as never);

    await authService.logout('64a000000000000000000001', cookieRes(), 'req-1');
    expect(user.refreshTokenHash).toBeUndefined();
    expect(user.save).toHaveBeenCalled();

    await expect(authService.refresh(tokens.refreshToken, cookieRes(), 'req-2')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('still expires auth cookies when logout has no authenticated user', async () => {
    const res = cookieRes();
    await authService.logout(undefined, res, 'req-3');
    expect(res.cookie).toHaveBeenCalledWith('accessToken', '', expect.objectContaining({ maxAge: 0 }));
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', '', expect.objectContaining({ maxAge: 0 }));
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 without a bearer token or cookie', async () => {
    const app = createApp();
    const response = await request(app).post('/api/auth/logout');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/accessToken=/),
        expect.stringMatching(/refreshToken=/),
      ]),
    );
  });
});
