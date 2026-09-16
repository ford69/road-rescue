import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

vi.mock('../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PAYSTACK_PUBLIC_KEY: 'pk_test',
    PRIMARY_CLIENT_ORIGIN: 'http://localhost:5173',
    PROVIDER_TRIAL_DAYS: 30,
    PROVIDER_ANNUAL_TRIAL_DAYS: 30,
    PAYSTACK_TOKENIZATION_AMOUNT_GHS: 1,
    PAYSTACK_PROVIDER_ANNUAL_PLAN_CODE: 'PLN_year',
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const initializePayment = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    authorizationUrl: 'https://checkout.paystack.com/onb',
    accessCode: 'code',
    reference: 'RR_PONB_abc',
  }),
);
const verifyPayment = vi.hoisted(() => vi.fn());
const refundTransaction = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const createRecurringSubscription = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ subscriptionCode: 'SUB_onb' }),
);

vi.mock('../payments/payment-provider.impl.js', () => ({
  getPaymentProvider: () => ({
    isConfigured: () => true,
    initializePayment,
    verifyPayment,
    refundTransaction,
    createRecurringSubscription,
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

const startAuthorizedTrial = vi.hoisted(() => vi.fn());
vi.mock('../services/provider-subscription.service.js', () => ({
  startAuthorizedTrial,
  tokenizationAmountGhs: () => 1,
}));

vi.mock('../models/ProviderRegistrationIntent.js', () => ({
  ProviderRegistrationIntent: {
    findOneAndUpdate: vi.fn(),
  },
}));

import { userRepository } from '../repositories/user.repository.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { providerRegistrationIntentRepository } from '../repositories/provider-registration-intent.repository.js';
import { ProviderRegistrationIntent } from '../models/ProviderRegistrationIntent.js';
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
  planSlug: 'provider_annual' as const,
};

describe('provider onboarding', () => {
  const res = { cookie: vi.fn() } as unknown as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(userRepository.findByPhone).mockResolvedValue(null);
    vi.mocked(mechanicRepository.findByGhanaCardNumber).mockResolvedValue(null);
    vi.mocked(providerRegistrationIntentRepository.findOpenByEmail).mockResolvedValue(null);
  });

  it('does not create an account until Paystack card authentication succeeds', async () => {
    const result = await providerOnboardingService.start(
      input,
      { filename: 'selfie.jpg' } as Express.Multer.File,
      res,
    );
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(mechanicRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/onb');
    expect(initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountGhs: 1,
        channels: ['card'],
        metadata: expect.objectContaining({ purpose: 'provider_onboarding' }),
      }),
    );
  });

  it('creates the provider account only after a reusable card authorization', async () => {
    const intent = {
      email: input.email,
      phone: input.phone,
      ghanaCardNumber: input.ghanaCardNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: 'hashed-password',
      garageName: input.garageName,
      experience: 4,
      city: 'Accra',
      address: 'Spintex',
      latitude: 5.6,
      longitude: -0.1,
      specialties: ['battery'],
      selfiePath: '/uploads/selfie.jpg',
      planSlug: 'provider_annual',
      status: 'pending_payment',
      expiresAt: new Date(Date.now() + 60_000),
      tokenizationRefunded: false,
      save: vi.fn(),
    };
    vi.mocked(providerRegistrationIntentRepository.findByReference).mockResolvedValue(intent as never);
    vi.mocked(ProviderRegistrationIntent.findOneAndUpdate).mockResolvedValue(intent as never);
    verifyPayment.mockResolvedValue({
      status: 'success',
      authorizationCode: 'AUTH_x',
      authorizationReusable: true,
      authorizationChannel: 'card',
      customerCode: 'CUS_x',
    });
    vi.mocked(userRepository.create).mockResolvedValue({
      _id: { toString: () => 'user1' },
      email: input.email,
      firstName: input.firstName,
    } as never);
    vi.mocked(mechanicRepository.create).mockResolvedValue({
      _id: { toString: () => 'mech1' },
    } as never);

    const result = await providerOnboardingService.complete('RR_PONB_abc', res);

    expect(userRepository.create).toHaveBeenCalled();
    expect(mechanicRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ verificationStatus: 'pending' }),
    );
    expect(startAuthorizedTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationCode: 'AUTH_x',
        planSlug: 'provider_annual',
      }),
    );
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'mechanic',
        email: input.email,
      }),
    );
    expect(result.requiresEmailVerification).toBe(true);
    expect(refundTransaction).toHaveBeenCalled();
  });
});
