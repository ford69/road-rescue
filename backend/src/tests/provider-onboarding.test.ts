import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

vi.mock('../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PAYSTACK_PUBLIC_KEY: 'pk_test',
    PRIMARY_CLIENT_ORIGIN: 'http://localhost:5173',
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../payments/payment-provider.impl.js', () => ({
  getPaymentProvider: () => ({
    isConfigured: () => true,
    verifyPayment: vi.fn(),
    refundTransaction: vi.fn(),
  }),
}));

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findByPhone: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock('../repositories/mechanic.repository.js', () => ({
  mechanicRepository: {
    findByGhanaCardNumber: vi.fn(),
    create: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock('../repositories/misc.repository.js', () => ({
  notificationRepository: { create: vi.fn() },
}));

vi.mock('../repositories/provider-registration-intent.repository.js', () => ({
  providerRegistrationIntentRepository: {
    findOpenByEmail: vi.fn(),
    create: vi.fn(),
    findByReference: vi.fn(),
  },
}));

vi.mock('../email/index.js', () => ({
  emailService: {
    sendVerificationEmail: vi.fn().mockResolvedValue({ sent: true }),
    sendMechanicApplicationReceivedEmail: vi.fn().mockResolvedValue({ sent: true }),
  },
}));

vi.mock('../uploads/storage.js', () => ({
  getPublicUploadPath: (name: string) => `/uploads/${name}`,
}));

vi.mock('../auth/tokens.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

vi.mock('../auth/email-verification.js', () => ({
  createEmailVerification: () => ({
    token: 'verify-token',
    tokenHash: 'verify-hash',
    expiresAt: new Date(Date.now() + 86_400_000),
  }),
}));

vi.mock('../auth/cookies.js', () => ({
  clearAuthCookies: vi.fn(),
}));

vi.mock('../models/ProviderRegistrationIntent.js', () => ({
  ProviderRegistrationIntent: {
    findOneAndUpdate: vi.fn(),
  },
}));

import { userRepository } from '../repositories/user.repository.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { emailService } from '../email/index.js';
import { providerOnboardingService } from '../services/provider-onboarding.service.js';

const input = {
  firstName: 'Kwame',
  lastName: 'Mensah',
  email: 'kwame@example.com',
  phone: '+233241111111',
  password: 'Password1',
  garageName: 'Kwame Rescue',
  ghanaCardNumber: 'GHA-123456789-0',
  experience: 4,
  city: 'Accra',
  address: 'Spintex',
  latitude: 5.6,
  longitude: -0.1,
  specialties: ['battery' as const],
};

describe('provider onboarding', () => {
  const res = { cookie: vi.fn() } as unknown as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(userRepository.findByPhone).mockResolvedValue(null);
    vi.mocked(mechanicRepository.findByGhanaCardNumber).mockResolvedValue(null);
    vi.mocked(userRepository.create).mockResolvedValue({
      _id: { toString: () => 'user1' },
      email: input.email,
      firstName: input.firstName,
    } as never);
    vi.mocked(mechanicRepository.create).mockResolvedValue({
      _id: { toString: () => 'mech1' },
    } as never);
  });

  it('creates the provider account immediately without a subscription checkout', async () => {
    const result = await providerOnboardingService.start(
      input,
      { filename: 'selfie.jpg' } as Express.Multer.File,
      res,
    );
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'mechanic', email: input.email.toLowerCase() }),
    );
    expect(mechanicRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ verificationStatus: 'pending', garageName: input.garageName }),
    );
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'mechanic',
        email: input.email,
      }),
    );
    expect(result.requiresEmailVerification).toBe(true);
    expect(result.email).toBe(input.email);
  });
});
